FROM python:3.12-slim

RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libgles2 \
    libegl1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
    mediapipe \
    opencv-python-headless \
    fastapi \
    "uvicorn[standard]" \
    numpy

COPY . .

EXPOSE 8000

CMD ["uvicorn", "websocket_server:app", "--host", "0.0.0.0", "--port", "8000"]