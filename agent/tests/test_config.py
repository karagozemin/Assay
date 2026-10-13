from config import load_agent_config
from pydantic import ValidationError
from api import RunRequest


def _production_env():
    return {
        "ASSAY_RUNTIME": "production",
        "ASSAY_BACKEND_URL": "https://assay-backend-07w0.onrender.com",
        "CORS_ORIGIN": (
            "https://www.assay-web.site,https://assay-web.site,"
            "https://assay-web.vercel.app"
        ),
        "ASSAY_TEST_SETTLE": "0",
        "ASSAY_MOCK_PAY": "0",
    }


def _must_fail(env, message):
    try:
        load_agent_config(env)
    except RuntimeError as exc:
        assert message in str(exc)
        return
    raise AssertionError("configuration unexpectedly passed")


def test_production_rejects_mock_pay():
    _must_fail({**_production_env(), "ASSAY_MOCK_PAY": "1"}, "forbidden")


def test_production_rejects_local_backend():
    _must_fail(
        {**_production_env(), "ASSAY_BACKEND_URL": "http://localhost:4000"},
        "persistent production origin",
    )


def test_production_rejects_trycloudflare_backend():
    _must_fail(
        {
            **_production_env(),
            "ASSAY_BACKEND_URL": "https://temporary.trycloudflare.com",
        },
        "persistent production origin",
    )


def test_production_uses_env_backend_only():
    config = load_agent_config(_production_env())
    assert config.backend_url == "https://assay-backend-07w0.onrender.com"
    assert config.cors_origins == (
        "https://www.assay-web.site",
        "https://assay-web.site",
        "https://assay-web.vercel.app",
    )


def test_public_run_request_rejects_backend_override():
    try:
        RunRequest(prompt="test", backend="https://evil.example")
    except ValidationError:
        return
    raise AssertionError("public /run payload accepted a backend override")
