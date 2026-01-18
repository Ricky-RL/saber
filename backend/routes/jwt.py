import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, Depends, Header
from config import JWT_SECRET
from supabase_client import supabase

router = APIRouter(prefix="/app/jwt", tags=["jwt"])

@router.get("/get")
def get_jwt():
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="JWT_SECRET not configured")
    
    expiration = datetime.utcnow() + timedelta(hours=1)
    payload = {
        "exp": expiration,
        "iat": datetime.utcnow()
    }
    
    token = jwt.encode(payload, JWT_SECRET, algorithm="HS256")
    return {"jwt": token}

def validate_jwt(token: str) -> bool:
    try:
        jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return True
    except jwt.ExpiredSignatureError:
        return False
    except jwt.InvalidTokenError:
        return False

async def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="Invalid authorization scheme")
            
        # Verify the token using supabase
        user = supabase.auth.get_user(token)
        if not user or not user.user:
             raise HTTPException(status_code=401, detail="Invalid token")
             
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
