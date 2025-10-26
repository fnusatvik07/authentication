from fastapi import HTTPException
from models import User
from database import cursor, conn
import bcrypt

def register_user(user: User):
    hashed_pw = bcrypt.hashpw(user.password.encode(), bcrypt.gensalt())
    try:
        cursor.execute("INSERT INTO users (username, password) VALUES (?, ?)", (user.username, hashed_pw))
        conn.commit()
        return {"msg": "User registered successfully"}
    except:
        raise HTTPException(status_code=400, detail="Username already exists")


from datetime import datetime, timedelta
from jose import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
EXPIRY_MINUTES = 30

def login_user(form_data: OAuth2PasswordRequestForm):
    cursor.execute("SELECT password FROM users WHERE username=?", (form_data.username,))
    row = cursor.fetchone()
    if not row or not bcrypt.checkpw(form_data.password.encode(), row[0]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    payload = {
        "sub": form_data.username,
        "exp": datetime.utcnow() + timedelta(minutes=EXPIRY_MINUTES)
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
    return {"access_token": token, "token_type": "bearer"}


from fastapi.security import OAuth2PasswordBearer
from jose import JWTError

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/token")

def get_current_user(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid or expired token")
