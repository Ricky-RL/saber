# Project Saber

## Backend Setup

### Prerequisites

- Python 3.12.10
- pip

### Installation

1. Navigate to the backend directory:

   ```bash
   cd backend
   ```

2. Create a virtual environment:

   ```bash
   python -m venv venv
   ```

3. Activate the virtual environment:
   - On Windows:
     ```bash
     .\venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
```bash
uvicorn main:app --reload
```

The API will be available at `http://127.0.0.1:8000`.
You can access the automatic documentation at `http://127.0.0.1:8000/docs`.
