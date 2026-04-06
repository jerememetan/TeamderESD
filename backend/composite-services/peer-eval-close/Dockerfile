FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY swagger_helper.py .
COPY peer-eval-close/ .
EXPOSE 4009
CMD ["python", "app.py"]
