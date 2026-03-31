# RabbitMQ Infrastructure Setup

This folder contains only RabbitMQ infrastructure setup for Teamder:
- Docker Compose for RabbitMQ (`rabbitmq:3-management`)
- AMQP topology setup script (`amqpsetup.py`)
- Python dependency list (`requirements.txt`)

No producer, consumer, notification service, or email logic is included.

## 1. Start RabbitMQ

From `backend/rabbitmq`:

```bash
docker compose -f compose.yaml up -d
```

RabbitMQ endpoints:
- AMQP: `localhost:5672`
- Management UI: `http://localhost:15672`
- Default credentials: `guest` / `guest`

## 2. Install Python dependency

From `backend/rabbitmq`:

```bash
pip install -r requirements.txt
```

## 3. Run topology setup script

From `backend/rabbitmq`:

```bash
python amqpsetup.py
```

The script creates:
- Durable topic exchange: `notification.topic`
- Durable queues:
  - `notification.email.queue`
  - `notification.sms.queue`
- Bindings:
  - `notification.email.queue` bound with routing key `notification.email`
  - `notification.sms.queue` bound with routing key `notification.sms`

## 4. Verify in Management UI

1. Open `http://localhost:15672`
2. Log in with `guest` / `guest`
3. Go to **Exchanges** and confirm `notification.topic` exists with type `topic` and durable enabled
4. Go to **Queues and Streams** and confirm:
   - `notification.email.queue` is durable
   - `notification.sms.queue` is durable
5. Open each queue and verify bindings include:
   - `notification.email`
   - `notification.sms`
