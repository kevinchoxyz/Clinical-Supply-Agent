from pydantic import Field, AliasChoices
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Make env parsing resilient on Windows and in mixed environments
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # <-- IMPORTANT: don't crash on unrelated env vars
    )

    APP_NAME: str = Field(
        default="clinical-supply-agent",
        validation_alias=AliasChoices("APP_NAME", "app_name"),
    )
    ENV: str = Field(
        default="dev",
        validation_alias=AliasChoices("ENV", "env"),
    )
    DATABASE_URL: str = Field(
        ...,
        validation_alias=AliasChoices("DATABASE_URL", "database_url"),
    )


settings = Settings()
