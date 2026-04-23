import logging
import os
import re
from typing import Any, Dict, List, Optional

from google import genai

logger = logging.getLogger(__name__)

MODEL_CANDIDATES = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]


def _model_candidates() -> List[str]:
    override = (os.getenv("GEMINI_MODEL") or "").strip()
    seen: set[str] = set()
    out: List[str] = []
    # Honour an explicit env-var override first, then the ordered candidates list
    candidates = ([override] if override else []) + MODEL_CANDIDATES
    for m in candidates:
        if m and m not in seen:
            seen.add(m)
            out.append(m)
    return out


def _gemini_error_kind(exc: BaseException) -> str:
    low = str(exc).lower()
    if "403" in low or "permission_denied" in low:
        if "leaked" in low or "blacklist" in low or "reported as leaked" in low:
            return "leaked_api_key"
        return "permission_denied"
    if "429" in low or "resource exhausted" in low or "quota" in low:
        return "rate_limit"
    return "other"


def _pick_representative_error(errors: List[BaseException]) -> BaseException:
    """Prefer leaked-key (403) over rate limits, then rate limit (429), else last failure."""
    for exc in errors:
        if _gemini_error_kind(exc) == "leaked_api_key":
            return exc
    for exc in errors:
        if _gemini_error_kind(exc) == "rate_limit":
            return exc
    return errors[-1]


def _normalize_model_name(name: str) -> str:
    n = name.strip()
    if n.startswith("models/"):
        return n[len("models/") :]
    return n


def _format_gemini_error(exc: BaseException) -> str:
    kind = _gemini_error_kind(exc)
    if kind == "leaked_api_key":
        return (
            "Security Alert: API Key is blacklisted/leaked. "
            "Please rotate your key in Google AI Studio."
        )
    if kind == "rate_limit":
        return "Gemini rate limit or quota exceeded. Try again later."

    msg = str(exc).strip() or exc.__class__.__name__
    low = msg.lower()
    if kind == "permission_denied" or ("401" in low and "api key" in low):
        return (
            "Gemini rejected the request (API key or permissions). "
            "Verify GEMINI_API_KEY in the server environment."
        )
    if "404" in low or "not found" in low or ("model" in low and ("invalid" in low or "not found" in low)):
        return (
            "The configured Gemini model is not available for this API version or project. "
            "Try setting GEMINI_MODEL to a supported id (e.g. gemini-2.5-flash or gemini-2.0-flash) in the dashboard."
        )
    if "503" in low or "unavailable" in low or "overloaded" in low:
        return "Gemini is temporarily unavailable. Try again in a few moments."
    return f"Gemini request failed: {msg}"


def _error_code_for_exception(exc: BaseException) -> str:
    kind = _gemini_error_kind(exc)
    if kind == "leaked_api_key":
        return "leaked_api_key"
    if kind == "rate_limit":
        return "rate_limit"
    if kind == "permission_denied":
        return "permission_denied"
    return "gemini_error"


def build_system_prompt(profile: Optional[Dict[str, Any]]) -> str:
    if profile:
        stats = (
            "\n**بيانات العضو الحالي:**\n"
            f"- الاسم:    {profile.get('name',   'يا بطل')}\n"
            f"- العمر:    {profile.get('age',    'مش محدد')} سنة\n"
            f"- الطول:    {profile.get('height', 'مش محدد')} سم\n"
            f"- الوزن:    {profile.get('weight', 'مش محدد')} كيلو\n"
            f"- الهدف:    {str(profile.get('goal', 'fit')).upper()}"
            f" ({_goal_description(profile.get('goal', 'fit'))})\n"
        )
    else:
        stats = "**مفيش بروفايل لسه.** اطلب من العضو يكمل بياناته الأساسية الأول."

    return (
        "أنت **ARIA** — كوتش جيم ذكي ومحفز، متخصص في اللياقة البدنية، التغذية، وتحقيق الأهداف الرياضية.\n"
        "أسلوبك: فكاهي، واثق، وعلمي في نفس الوقت. بتحفز الناس بطريقة مصرية أصيلة.\n"
        "استخدم تعبيرات زي: 'يا وحش'، 'يا فورمة'، 'يا بطل المجرة'، 'عايزين فورمة الساحل'،\n"
        "'الجيم مش بيكدب'، 'الحديد بيتكلم'، 'ركز يا معلم'.\n\n"
        "**بروتوكول الهوية (إلزامي):**\n"
        "- ابقَ في دورك كـ كوتش جيم في كل الأوقات.\n"
        "- فقط لو سألك المستخدم صراحةً عن مطوّرك، رد بالضبط:\n"
        "  'تم تطويري وهندستي بواسطة المهندس طاهر وائل، متخصص في الذكاء الاصطناعي.'\n"
        "- بعد الإجابة، ارجع فوراً لدورك كـ كوتش جيم.\n\n"
        f"{stats}\n\n"
        "**مواعيد الجيم:** ١٠ صباحاً لـ ١١ مساءً — كل يوم في الأسبوع.\n\n"
        "**بروتوكول الاكتشاف (إلزامي قبل أي خطة):**\n"
        "قبل ما تدي أي برنامج تدريبي أو غذائي أو مكملات، لازم تسأل:\n"
        "1. 🎯 إيه هدفك التحديدي؟ (تضخيم / تنشيف / لياقة عامة؟)\n"
        "2. 🩺 عندك أي إصابات أو أمراض مزمنة؟\n"
        "3. 🥗 في أكل بتكرهه أو عندك حساسية منه؟\n"
        "4. 💪 مستواك التدريبي إيه؟ (مبتدئ / متوسط / متقدم؟)\n\n"
        "**قواعد التمارين:**\n"
        "- اعرض البرنامج في جدول Markdown: اليوم | التمرين | السيتات | الرابتات | الراحة.\n\n"
        "**قواعد التغذية:**\n"
        "- اعرض الخطة في جدول Markdown: الوجبة | الأكل | السعرات | البروتين | الكارب | الدهون.\n\n"
        "**قواعد المكملات:**\n"
        "- قبل أي كلام عن مكملات: 'أنا AI ومش دكتور — استشير دكتور متخصص.'\n\n"
        "**تحديث الوزن:**\n"
        "- لو العضو ذكر وزنه الجديد، حط الماركر ده في ردك: [WEIGHT_UPDATE:القيمة]\n"
        "  مثال: 'تمام يا بطل! [WEIGHT_UPDATE:80]'\n\n"
        "**مهمتك:** مساعدة كل عضو يوصل لأفضل نسخة من نفسه.\n"
        "دايماً شخصن ردودك باستخدام بيانات العضو الفعلية.\n"
    )


def _goal_description(goal: str) -> str:
    return {
        "bulk": "تضخيم وبناء عضلات",
        "cut": "تنشيف وحرق دهون",
        "fit": "لياقة عامة وصحة",
    }.get(goal, "لياقة عامة")


def extract_weight_update(text: str) -> Optional[float]:
    match = re.search(r"\[WEIGHT_UPDATE:([\d.]+)\]", text)
    if match:
        try:
            return float(match.group(1))
        except ValueError:
            return None
    return None


def clean_response(text: str) -> str:
    return re.sub(r"\[WEIGHT_UPDATE:[\d.]+\]", "", text).strip()


def _get_genai_client(api_key: str) -> genai.Client:
    return genai.Client(api_key=api_key)


def chat(
    user_message: str,
    profile: Optional[Dict[str, Any]],
    history: List[Dict[str, str]],
) -> Dict[str, Any]:
    api_key = os.getenv("GEMINI_API_KEY")

    # Fallback: if env var is missing, try reading the root .env manually
    if not api_key:
        _env_path = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", ".env")
        )
        if os.path.isfile(_env_path):
            with open(_env_path, "r", encoding="utf-8") as _f:
                for _line in _f:
                    _line = _line.strip()
                    if _line.startswith("GEMINI_API_KEY="):
                        api_key = _line.split("=", 1)[1].strip().strip('"').strip("'")
                        if api_key:
                            os.environ["GEMINI_API_KEY"] = api_key
                            logger.info("GEMINI_API_KEY loaded via manual .env fallback.")
                        break
    if not api_key:
        logger.warning("GEMINI_API_KEY is not set; chat requests will fail until it is configured.")
        return {
            "response": (
                "AI is not configured on this server (GEMINI_API_KEY is missing). "
                "Add the key in the hosting dashboard or a local .env file."
            ),
            "success": False,
            "error_code": "missing_api_key",
        }

    try:
        client = _get_genai_client(api_key)
    except Exception as e:
        logger.exception("Failed to initialize Gemini client: %s", e)
        return {
            "response": "Could not initialize the Gemini client. Check GEMINI_API_KEY format.",
            "success": False,
            "error_code": "client_init_failed",
            "detail": str(e),
        }

    system_text = build_system_prompt(profile)
    recent = history[-10:]
    history_text = ""
    for msg in recent:
        label = "ARIA" if msg.get("role") in ("model", "assistant") else "العضو"
        history_text += f"{label}: {msg.get('content', '')}\n"

    prompt = (
        f"{system_text}\n\n"
        "---\n"
        f"{history_text}"
        "---\n"
        f"العضو: {user_message}\n"
        "ARIA:"
    )

    failures: List[BaseException] = []
    first_candidate = True
    for raw_model in _model_candidates():
        model_try = _normalize_model_name(raw_model)
        try:
            resp = client.models.generate_content(model=model_try, contents=prompt)
            text = getattr(resp, "text", None)
            if text is None:
                text = str(resp)
            if first_candidate:
                logger.info("Gemini response OK using model=%s", model_try)
            else:
                logger.info(f"Successfully connected using model: {model_try}")
            return {"response": str(text), "success": True, "model_used": model_try}
        except Exception as e:
            failures.append(e)
            logger.warning("Gemini generate_content failed for model=%s: %s", model_try, e)
            first_candidate = False

    if not failures:
        return {
            "response": "No Gemini model candidates were available.",
            "success": False,
            "error_code": "gemini_error",
            "detail": "empty_model_list",
        }
    last_error = _pick_representative_error(failures)
    friendly = _format_gemini_error(last_error)
    err_code = _error_code_for_exception(last_error)
    logger.error("All Gemini model candidates failed. Representative error: %s", last_error)
    return {
        "response": friendly,
        "success": False,
        "error_code": err_code,
        "detail": str(last_error).strip() or last_error.__class__.__name__,
    }
