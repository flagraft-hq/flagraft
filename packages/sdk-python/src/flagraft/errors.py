class FlagraftError(Exception):
    def __init__(self, message: str, status_code: int, code: str) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code

    def __reduce__(self) -> tuple[type["FlagraftError"], tuple[str, int, str]]:
        return FlagraftError, (self.message, self.status_code, self.code)
