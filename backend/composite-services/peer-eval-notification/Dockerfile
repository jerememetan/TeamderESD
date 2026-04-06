FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY swagger_helper.py .
COPY peer-eval-notification/ .
EXPOSE 4008
CMD ["python", "app.py"]
