FROM python:3.11-slim

WORKDIR /project-topic

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "project-topic.app"]
