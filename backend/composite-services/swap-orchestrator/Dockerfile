FROM python:3.11-slim

WORKDIR /swap-orchestrator

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 4005
CMD ["python", "app.py"]
