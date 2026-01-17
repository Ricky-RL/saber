from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import router

app = FastAPI()


@app.get("/")
def read_root():
    return {
        "message": "Saber Quiz API",
        "endpoints": {
            "/generate-quiz": "POST - Upload a PDF file to generate a quiz",
            "/docs": "GET - Interactive API documentation",
            "/app/jwt/get": "GET - Get JWT token"
        }
    }


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
