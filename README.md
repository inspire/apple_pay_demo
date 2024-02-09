# apple_pay_demo

# for the Apple Pay Merchant Identity Certificate you can do this CSR via openssl to make it easy to have the key and cert

> cd keys
> openssl genrsa -out private_key.pem 2048
> openssl req -new -key private_key.pem -out csr.pem

# Download from Apple

Convert to .pem file

> openssl x509 -in merchant_id.cer -inform DER -out merchant_key.pem -outform PEM

# for payment cert

> cd keys
> openssl ecparam -out payment_private.key -name prime256v1 -genkey
> openssl req -new -key payment_private.key -out request.csr

# upload request.csr to apple and then download certificate

> openssl x509 -inform der -in payment_cert.cer -out payment_cert.pem


# To run and validate locally - change

<script src="valueio.js"></script>

to

<script src="recurring.js"></script>

> cd server && bundle exec ruby server.rb
