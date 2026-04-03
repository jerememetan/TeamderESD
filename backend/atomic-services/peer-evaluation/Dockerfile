FROM python:3.11-slim

WORKDIR /peer-evaluation

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "peer-evaluation/app.py"]
