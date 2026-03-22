FROM python:3.11-slim

WORKDIR /swap-request

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "swap_request.app"]
