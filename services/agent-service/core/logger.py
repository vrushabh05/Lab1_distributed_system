# services/agent-service/core/logger.py
import logging
import sys
import json
from uuid import uuid4

class JsonFormatter(logging.Formatter):
    def format(self, record):
        service_name = getattr(record, 'service_name', getattr(self, 'service_name', record.name))
        log_record = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "service": service_name,
        }
        if hasattr(record, 'correlation_id'):
            log_record['correlation_id'] = record.correlation_id
        
        if record.exc_info:
            log_record['exception'] = self.formatException(record.exc_info)
            
        # Add extra fields from the log call
        extra_fields = record.__dict__.get('extra', {})
        if extra_fields:
            log_record.update(extra_fields)

        return json.dumps(log_record)

def create_logger(service_name, level='INFO'):
    logger = logging.getLogger(service_name)
    logger.setLevel(level)
    
    # Prevent duplicate handlers
    if logger.hasHandlers():
        logger.handlers.clear()

    handler = logging.StreamHandler(sys.stdout)
    formatter = JsonFormatter()
    formatter.service_name = service_name
    handler.setFormatter(formatter)
    
    logger.addHandler(handler)
    
    # Add helper methods to logger
    def generate_correlation_id():
        return str(uuid4())

    def child(correlation_id):
        # Create a proxy logger that includes the correlation_id
        class ChildLogger(logging.LoggerAdapter):
            def process(self, msg, kwargs):
                kwargs['extra'] = kwargs.get('extra', {})
                kwargs['extra']['correlation_id'] = self.extra['correlation_id']
                return msg, kwargs

        return ChildLogger(logger, {'correlation_id': correlation_id})

    logger.generate_correlation_id = generate_correlation_id
    logger.child = child
    
    return logger
