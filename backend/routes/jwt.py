import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from config import JWT_SECRET

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
