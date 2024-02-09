require 'sinatra'
require 'sinatra/cross_origin'
require 'net/http'
require 'json'
require 'openssl'
require 'logger'
require 'gala'
require 'base64'


get '/hello' do
  "Hi!"
end

require 'sinatra'
require 'json'
require 'net/http'
require 'uri'

configure do
  enable :cross_origin
end

require 'sinatra/reloader' if development?
configure :development do
  register Sinatra::Reloader
end

before do
  response.headers['Access-Control-Allow-Origin'] = '*'
end

options '*' do
  response.headers['Allow'] = 'GET, POST, PUT, DELETE, OPTIONS'
  response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With, Access-Control-Allow-Origin'
  response.headers['Access-Control-Allow-Origin'] = '*'
  200
end



post '/v1/apple_pay/validate_session' do
  
  request.body.rewind
  request_payload = JSON.parse request.body.read
   puts request_payload
  apple_url = request_payload['appleUrl']

  uri = URI.parse(apple_url)
  http = Net::HTTP.new(uri.host, uri.port)
  http.use_ssl = true
  http.verify_mode = OpenSSL::SSL::VERIFY_NONE

  if(ENV["MERCHANT_CERT"].nil? || ENV["MERCHANT_KEY"].nil?)
    cert = File.read('./keys/merchant_cert.pem')
    key = File.read('./keys/merchant_private_key.pem')
  else
    cert = Base64.decode64(ENV["MERCHANT_CERT"])
    key = Base64.decode64(ENV["MERCHANT_KEY"])
  end

  http.cert = OpenSSL::X509::Certificate.new(cert)
  http.key = OpenSSL::PKey::RSA.new(key)

  req = Net::HTTP::Post.new(uri.path, 'Content-Type' => 'application/json')
  req.body = {
    merchantIdentifier: 'merchant.io.value.applepay',
    domainName: 'foo-digidigo.ngrok.dev',
    displayName: 'Your Shop Name'
  }.to_json

  res = http.request(req)

  res.body
end

# Add the decrypt_apple_pay_token method here
# Ruby equivalent of pycryptopp decryption logic will be implemented here

post '/v1/payments' do
  data = JSON.parse(request.body.read)
  token = data['token']

  # Load your merchant private key and certificate
  private_key = OpenSSL::PKey::EC.new(File.read('./keys/payment_private_key.pem'))
  certificate = OpenSSL::X509::Certificate.new(File.read('./keys/payment_cert.pem'))

  # Decrypt Apple Pay token using Gala
  gala = Gala::PaymentToken.new(token["paymentData"])
  decrypted_token = gala.decrypt(certificate, private_key) 
  logger = Logger.new(STDOUT)
  logger.info("Data received: #{data.to_json}")
  logger.info("Token received: #{token.to_json}")
  logger.info("Decrypted token: #{decrypted_token}")
  # Process decrypted token...
  { approved: true }.to_json
end


set :port, 3000
set :bind, '0.0.0.0'
