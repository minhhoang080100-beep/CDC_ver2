FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 5050

# Run with gunicorn (multi-worker) for production
# - 4 workers handle concurrent requests
# - UvicornWorker provides async support
# - timeout 120s for long uploads/aggregations
# - graceful-timeout 30s for clean shutdown on Render
CMD ["gunicorn", "app.main:app", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--workers", "4", \
     "--bind", "0.0.0.0:5050", \
     "--timeout", "120", \
     "--graceful-timeout", "30", \
     "--keep-alive", "5", \
     "--access-logfile", "-"]
