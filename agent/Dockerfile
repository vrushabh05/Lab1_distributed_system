<<<<<<< HEAD
=======
# agent/Dockerfile
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
<<<<<<< HEAD
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
=======
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
>>>>>>> ffcac8c (Added my updated backend + frontend fixes and report)
