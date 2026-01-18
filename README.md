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

5. Create a `.env` file in the backend directory with your API keys:
   ```bash
   ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
   JWT_SECRET=your-secret-key-change-in-production
   ```
   
   You can get your ElevenLabs API key from https://elevenlabs.io/app/settings/api-keys

6. Run the backend server:
   ```bash
   uvicorn main:app --reload
   ```

The API will be available at `http://127.0.0.1:8000`.
You can access the automatic documentation at `http://127.0.0.1:8000/docs`.

#test