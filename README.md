# Event-Management-System
A web-based Event Management System that allows users to register, view events, and book events. Includes event creation and management features, developed collaboratively using Agile practices for a college project.

## Khalti Payment Note
This project now uses Khalti ePayment checkout through the Khalti sandbox API for college project testing.

The secret key stays on the backend in `.env` as `KHALTI_SECRET_KEY`. The frontend only receives the checkout URL, and the booking is verified with Khalti lookup before confirmation.

Bookings have a 30-minute payment window. If the payment is not completed within that time, the checkout expires and the user must start again.
