from fastapi import FastAPI, Depends
from auth import register_user, login_user, get_current_user
from models import User
from fastapi.security import OAuth2PasswordRequestForm

app = FastAPI()

@app.post("/register")
def register(user: User):
    return register_user(user)

@app.post("/token")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    return login_user(form_data)

@app.get("/protected")
def protected_route(user: str = Depends(get_current_user)):
    return {"msg": f"Welcome {user}, you are authorized!"}
