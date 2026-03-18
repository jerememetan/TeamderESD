FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY formation-setup/ .
EXPOSE 3010
CMD ["python", "app.py"]
