import pickle

from flagraft import FlagraftError


def test_preserves_status_code_and_message() -> None:
    error = FlagraftError("Invalid API key", 401, "Unauthorized")
    assert isinstance(error, Exception)
    assert str(error) == "Invalid API key"
    assert error.message == "Invalid API key"
    assert error.status_code == 401
    assert error.code == "Unauthorized"


def test_survives_pickling() -> None:
    error = pickle.loads(pickle.dumps(FlagraftError("Invalid API key", 401, "Unauthorized")))
    assert (error.message, error.status_code, error.code) == (
        "Invalid API key",
        401,
        "Unauthorized",
    )
