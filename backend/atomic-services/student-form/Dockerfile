FROM python:3.11-slim

WORKDIR /student-form

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "-m", "student_form.app"]
