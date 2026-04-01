"""Pydantic models for the auth service."""

from pydantic import BaseModel


class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    department: str = "general"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str
    department: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class RoleUpdate(BaseModel):
    role: str


# ──────────────────────────────────────────────────────
# Chat / ReAct Agent models
# ──────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatQuery(BaseModel):
    message: str
    conversation_history: list[ChatMessage] = []


class ReasoningStep(BaseModel):
    step: int
    type: str  # "thought", "observation", "error"
    content: str
    tool: str | None = None
    result_count: int | None = None


class ChatResponse(BaseModel):
    answer: str
    tools_used: list[str]
    sources: list[dict]
    reasoning_steps: list[dict]
    user_role: str
