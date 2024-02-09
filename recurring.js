var applePayUiController = (function () {
  var DOMStrings = {
    appleButton: "ckoApplePay",
    errorMessage: "ckoApplePayError",
  };
  return {
    DOMStrings,
    displayApplePayButton: function () {
      document.getElementById(DOMStrings.appleButton).style.display = "block";
    },
    hideApplePayButton: function () {
      document.getElementById(DOMStrings.appleButton).style.display = "none";
    },
    displayErrorMessage: function () {
      document.getElementById(DOMStrings.errorMessage).style.display = "block";
    },
  };
})();

var applePayController = (function (uiController) {
  var BACKEND_URL_VALIDATE_SESSION =
    "https://digidigo.ngrok.dev/v1/apple_pay/validate_session";
  var BACKEND_URL_PAY = "https://digidigo.ngrok.dev/v1/payments";
  var BACKEND_URL_TOKEN_NOTIFY =
    "https://digidigo.ngrok.dev/v1/apple_pay/token_notify";

  var _applePayAvailable = function () {
    return window.ApplePaySession && ApplePaySession.canMakePayments();
  };

  var _startApplePaySession = function () {
    var applePaySessionConfig = {
      countryCode: "US",
      currencyCode: "USD",
      supportedNetworks: ["visa", "masterCard"],
      merchantCapabilities: ["supports3DS"],
      total: {
        label: "Merchant Name (Subscription)",
        amount: "10.00",
        type: "final",
      },
      lineItems: [
        {
          label: "Monthly Subscription",
          amount: "10.00",
          type: "final",
        },
      ],
      requiredBillingContactFields: ["postalAddress", "name", "phone", "email"], // Moved here
      recurringPaymentRequest: {
        supportedCountries: ["US"],
        merchantCapabilities: [
          "supports3DS",
          "supportsCredit",
          "supportsDebit",
        ],
        total: {
          label: "Merchant Name",
          amount: "10.00",
          type: "final",
        },
        lineItems: [
          {
            label: "Monthly Subscription Fee",
            amount: "10.00",
            type: "final",
          },
        ],
        supportedNetworks: ["visa", "masterCard"],
        countryCode: "US",
        currencyCode: "USD",
        managementURL: "https://digidigo.ngrok.dev/manage",
        tokenNotificationURL: BACKEND_URL_TOKEN_NOTIFY,
        paymentDescription: "Monthly Subscription",
        regularBilling: {
          label: "Subscription",
          amount: "10.00",
          paymentTiming: "recurring",
          recurringPaymentIntervalUnit: "month",
          recurringPaymentStartDate: new Date().toISOString().split("T")[0],
        },
      },
    };

    var applePaySession = new ApplePaySession(14, applePaySessionConfig);
    _handleApplePayEvents(applePaySession);
    applePaySession.begin();
  };

  var _validateApplePaySession = function (appleUrl, callback) {
    axios
      .post(
        BACKEND_URL_VALIDATE_SESSION,
        { appleUrl },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      )
      .then(function (response) {
        callback(response.data);
      })
      .catch(function (error) {
        console.error("Error validating Apple Pay session:", error);
        callback(null);
      });
  };

  var _handleApplePayEvents = function (appleSession) {
    appleSession.onvalidatemerchant = function (event) {
      _validateApplePaySession(event.validationURL, function (merchantSession) {
        appleSession.completeMerchantValidation(merchantSession);
      });
    };

    appleSession.onpaymentauthorized = function (event) {
      processApplePayPayment(event.payment, function (response) {
        if (response.approved) {
          appleSession.completePayment(ApplePaySession.STATUS_SUCCESS);
        } else {
          appleSession.completePayment(ApplePaySession.STATUS_FAILURE);
        }
      });
    };
  };

  function processApplePayPayment(payment, callback) {
    axios
      .post(
        BACKEND_URL_PAY,
        {
          token: payment.token,
          billingDetails: payment.billingContact,
          shippingDetails: payment.shippingContact,
          paymentData: payment,
        },
        { headers: { "Access-Control-Allow-Origin": "*" } }
      )
      .then(function (response) {
        callback(response.data);
      })
      .catch(function (error) {
        console.error("Error processing Apple Pay payment:", error);
        callback({ approved: false });
      });
  }

  var _setButtonClickListener = function () {
    document
      .getElementById(uiController.DOMStrings.appleButton)
      .addEventListener("click", function () {
        _startApplePaySession();
      });
  };

  return {
    init: function () {
      if (_applePayAvailable()) {
        uiController.displayApplePayButton();
      } else {
        uiController.hideApplePayButton();
        uiController.displayErrorMessage();
      }

      _setButtonClickListener();
    },
  };
})(applePayUiController);

applePayController.init();
