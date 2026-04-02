FROM python:3.11-slim

WORKDIR /error

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "error.app"]
