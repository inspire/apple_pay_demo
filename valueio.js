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
        label: config.get("display_name"),
        amount: config.get("amount"),
        type: "final",
      },
      lineItems: [
        {
          label: "Monthly Subscription",
          amount: config.get("amount"),
          type: "final",
        },
      ],
      requiredBillingContactFields: ["postalAddress", "name", "phone", "email"],
      recurringPaymentRequest: {
        supportedCountries: ["US"],
        merchantCapabilities: [
          "supports3DS",
          "supportsCredit",
          "supportsDebit",
        ],
        total: {
          label: config.display_name,
          amount: config.get("amount"),
          type: "final",
        },
        lineItems: [
          {
            label: "Monthly Subscription Fee",
            amount: config.get("amount"),
            type: "final",
          },
        ],
        supportedNetworks: ["visa", "masterCard"],
        countryCode: "US",
        currencyCode: "USD",
        managementURL: `${config.get("base_url")}/manage`,
        tokenNotificationURL:
          config.get("base_url") + "/v1/apple_pay/token_notify",
        paymentDescription: "Monthly Subscription",
        regularBilling: {
          label: "Subscription",
          amount: config.get("amount"),
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
    var postData = {
      destination_identifier: config.get("destination"),
      domain_name: config.get("domain_name"),
      display_name: config.get("display_name"),
      apple_url: appleUrl,
    };

    axios
      .post(
        config.get("base_url") + "/v1/apple_pay/validate_session",
        postData,
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            Authorization: generateBasicAuthHeader(),
          },
        }
      )
      .then(function (response) {
        if (
          response.data.data.response.statusCode <= 200 ||
          response.data.data.response.statusCode >= 300
        ) {
          showAlert(
            "Error Validating: " +
              response.data.data.response.statusCode +
              " " +
              response.data.data.response.statusMessage,
            5000,
            true
          );
          console.error(
            "Error validating Apple Pay session:",
            response.data.data.response.statusMessage
          );
        } else {
          callback(response.data.data.response);
        }
      })
      .catch(function (error) {
        showAlert("Error Validating: " + error, 5000, true);
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

    appleSession.oncancel = function (event) {
      console.log("User cancelled Apple Pay session");
      // Handle the cancellation here
      showAlert("User cancelled.", 5000, true);
    };

    // appleSession.onpaymentmethodselected = function (event) {
    //   // Check if the selected payment method is valid
    //   // If not, mark the payment as failed
    //   if (!isValidPaymentMethod(event.paymentMethod)) {
    //     showAlert("Invalid payment method.", 5000);
    //     appleSession.completePaymentMethodSelection(
    //       ApplePaySession.STATUS_FAILURE
    //     );
    //   } else {
    //     appleSession.completePaymentMethodSelection(
    //       ApplePaySession.STATUS_SUCCESS
    //     );
    //   }
    // };

    appleSession.onpaymentauthorized = function (event) {
      processApplePayPayment(event.payment, function (response) {
        if (response.approved) {
          appleSession.completePayment(ApplePaySession.STATUS_SUCCESS);
        } else {
          showAlert("Payment failed.", 5000, true);
          appleSession.completePayment(ApplePaySession.STATUS_FAILURE);
        }
      });
    };
  };

  function processApplePayPayment(payment, callback) {
    var address1 = "";
    var address2 = "";

    if (payment.billingContact.addressLines.length > 0) {
      address1 = payment.billingContact.addressLines[0];
    }

    if (payment.billingContact.addressLines.length > 1) {
      address2 = payment.billingContact.addressLines[1];
    }

    var test = config.get("test_transaction");

    // First, create a credit card
    axios
      .post(
        config.get("base_url") + "/v1/credit_cards",
        {
          credit_card: {
            apple_pay_token: payment.token,
            first_name: payment.billingContact.givenName,
            last_name: payment.billingContact.familyName,
            address1: address1,
            address2: address2,
            city: payment.billingContact.locality,
            state: payment.billingContact.administrativeArea,
            zip: payment.billingContact.postalCode,
            country: getCountryCode(payment.billingContact.country),
            email: payment.billingContact.email,
            phone: payment.billingContact.phone,
            vaulted: true,
          },
        },
        {
          headers: {
            "Access-Control-Allow-Origin": "*",
            Authorization: generateBasicAuthHeader(),
          },
        }
      )
      .then(function (creditCardResponse) {
        // Extract the credit card identifier from the response
        var creditCardIdentifier =
          creditCardResponse.data.data.credit_card.identifier;

        // Now make the payment using the credit card identifier
        return axios.post(
          config.get("base_url") + "/v1/payments",
          {
            payment: {
              amount: config.get("amount"),
              credit_card: creditCardIdentifier,
              destination: config.get("destination"),
              test: test,
              gateway_options: {
                domain: config.get("domain_name"),
              },
            },
          },
          {
            headers: {
              "Access-Control-Allow-Origin": "*",
              Authorization: generateBasicAuthHeader(),
            },
          }
        );
      })
      .then(function (paymentResponse) {
        // Payment successful
        callback({ approved: true });
        showAlert("Payment successful.", 5000);
      })
      .catch(function (error) {
        console.error("Error processing Apple Pay payment:", error);
        callback({ approved: false });
        showAlert("Payment failed.", 5000, true);
      });
  }

  function generateBasicAuthHeader() {
    var credentials = config.get("username") + ":" + config.get("password");
    var encodedCredentials = btoa(credentials);
    return "Basic " + encodedCredentials;
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
})(applePayUiController, config);

window.addEventListener("load", function () {
  applePayController.init();
});

function getCountryCode(countryName) {
  let foundKey;

  for (let key in countries) {
    const country = countries[key];

    if (typeof country === "string" && country === countryName) {
      foundKey = key;
      break;
    } else if (Array.isArray(country) && country.includes(countryName)) {
      foundKey = key;
      break;
    }
  }

  if (foundKey) {
    return foundKey;
  } else {
    throw new Error(`No key found for ${countryName}`);
  }
}

// Country lookup
const countries = {
  AF: "Afghanistan",
  AL: "Albania",
  DZ: "Algeria",
  AS: "American Samoa",
  AD: "Andorra",
  AO: "Angola",
  AI: "Anguilla",
  AQ: "Antarctica",
  AG: "Antigua and Barbuda",
  AR: "Argentina",
  AM: "Armenia",
  AW: "Aruba",
  AU: "Australia",
  AT: "Austria",
  AZ: "Azerbaijan",
  BS: "Bahamas",
  BH: "Bahrain",
  BD: "Bangladesh",
  BB: "Barbados",
  BY: "Belarus",
  BE: "Belgium",
  BZ: "Belize",
  BJ: "Benin",
  BM: "Bermuda",
  BT: "Bhutan",
  BO: "Bolivia",
  BA: "Bosnia and Herzegovina",
  BW: "Botswana",
  BV: "Bouvet Island",
  BR: "Brazil",
  IO: "British Indian Ocean Territory",
  BN: "Brunei Darussalam",
  BG: "Bulgaria",
  BF: "Burkina Faso",
  BI: "Burundi",
  KH: "Cambodia",
  CM: "Cameroon",
  CA: "Canada",
  CV: "Cape Verde",
  KY: "Cayman Islands",
  CF: "Central African Republic",
  TD: "Chad",
  CL: "Chile",
  CN: ["People's Republic of China", "China"],
  CX: "Christmas Island",
  CC: "Cocos (Keeling) Islands",
  CO: "Colombia",
  KM: "Comoros",
  CG: ["Republic of the Congo", "Congo"],
  CD: ["Democratic Republic of the Congo", "Congo"],
  CK: "Cook Islands",
  CR: "Costa Rica",
  CI: ["Cote d'Ivoire", "Côte d'Ivoire", "Ivory Coast"],
  HR: "Croatia",
  CU: "Cuba",
  CY: "Cyprus",
  CZ: ["Czech Republic", "Czechia"],
  DK: "Denmark",
  DJ: "Djibouti",
  DM: "Dominica",
  DO: "Dominican Republic",
  EC: "Ecuador",
  EG: "Egypt",
  SV: "El Salvador",
  GQ: "Equatorial Guinea",
  ER: "Eritrea",
  EE: "Estonia",
  ET: "Ethiopia",
  FK: "Falkland Islands (Malvinas)",
  FO: "Faroe Islands",
  FJ: "Fiji",
  FI: "Finland",
  FR: "France",
  GF: "French Guiana",
  PF: "French Polynesia",
  TF: "French Southern Territories",
  GA: "Gabon",
  GM: ["Republic of The Gambia", "The Gambia", "Gambia"],
  GE: "Georgia",
  DE: "Germany",
  GH: "Ghana",
  GI: "Gibraltar",
  GR: "Greece",
  GL: "Greenland",
  GD: "Grenada",
  GP: "Guadeloupe",
  GU: "Guam",
  GT: "Guatemala",
  GN: "Guinea",
  GW: "Guinea-Bissau",
  GY: "Guyana",
  HT: "Haiti",
  HM: "Heard Island and McDonald Islands",
  VA: "Holy See (Vatican City State)",
  HN: "Honduras",
  HK: "Hong Kong",
  HU: "Hungary",
  IS: "Iceland",
  IN: "India",
  ID: "Indonesia",
  IR: ["Islamic Republic of Iran", "Iran"],
  IQ: "Iraq",
  IE: "Ireland",
  IL: "Israel",
  IT: "Italy",
  JM: "Jamaica",
  JP: "Japan",
  JO: "Jordan",
  KZ: "Kazakhstan",
  KE: "Kenya",
  KI: "Kiribati",
  KP: "North Korea",
  KR: ["South Korea", "Korea, Republic of", "Republic of Korea"],
  KW: "Kuwait",
  KG: "Kyrgyzstan",
  LA: "Lao People's Democratic Republic",
  LV: "Latvia",
  LB: "Lebanon",
  LS: "Lesotho",
  LR: "Liberia",
  LY: "Libya",
  LI: "Liechtenstein",
  LT: "Lithuania",
  LU: "Luxembourg",
  MO: "Macao",
  MG: "Madagascar",
  MW: "Malawi",
  MY: "Malaysia",
  MV: "Maldives",
  ML: "Mali",
  MT: "Malta",
  MH: "Marshall Islands",
  MQ: "Martinique",
  MR: "Mauritania",
  MU: "Mauritius",
  YT: "Mayotte",
  MX: "Mexico",
  FM: "Micronesia, Federated States of",
  MD: "Moldova, Republic of",
  MC: "Monaco",
  MN: "Mongolia",
  MS: "Montserrat",
  MA: "Morocco",
  MZ: "Mozambique",
  MM: "Myanmar",
  NA: "Namibia",
  NR: "Nauru",
  NP: "Nepal",
  NL: "Netherlands",
  NC: "New Caledonia",
  NZ: "New Zealand",
  NI: "Nicaragua",
  NE: "Niger",
  NG: "Nigeria",
  NU: "Niue",
  NF: "Norfolk Island",
  MK: ["The Republic of North Macedonia", "North Macedonia"],
  MP: "Northern Mariana Islands",
  NO: "Norway",
  OM: "Oman",
  PK: "Pakistan",
  PW: "Palau",
  PS: ["State of Palestine", "Palestine"],
  PA: "Panama",
  PG: "Papua New Guinea",
  PY: "Paraguay",
  PE: "Peru",
  PH: "Philippines",
  PN: ["Pitcairn", "Pitcairn Islands"],
  PL: "Poland",
  PT: "Portugal",
  PR: "Puerto Rico",
  QA: "Qatar",
  RE: "Reunion",
  RO: "Romania",
  RU: ["Russian Federation", "Russia"],
  RW: "Rwanda",
  SH: "Saint Helena",
  KN: "Saint Kitts and Nevis",
  LC: "Saint Lucia",
  PM: "Saint Pierre and Miquelon",
  VC: "Saint Vincent and the Grenadines",
  WS: "Samoa",
  SM: "San Marino",
  ST: "Sao Tome and Principe",
  SA: "Saudi Arabia",
  SN: "Senegal",
  SC: "Seychelles",
  SL: "Sierra Leone",
  SG: "Singapore",
  SK: "Slovakia",
  SI: "Slovenia",
  SB: "Solomon Islands",
  SO: "Somalia",
  ZA: "South Africa",
  GS: "South Georgia and the South Sandwich Islands",
  ES: "Spain",
  LK: "Sri Lanka",
  SD: "Sudan",
  SR: "Suriname",
  SJ: "Svalbard and Jan Mayen",
  SZ: "Eswatini",
  SE: "Sweden",
  CH: "Switzerland",
  SY: "Syrian Arab Republic",
  TW: ["Taiwan, Province of China", "Taiwan"],
  TJ: "Tajikistan",
  TZ: ["United Republic of Tanzania", "Tanzania"],
  TH: "Thailand",
  TL: "Timor-Leste",
  TG: "Togo",
  TK: "Tokelau",
  TO: "Tonga",
  TT: "Trinidad and Tobago",
  TN: "Tunisia",
  TR: ["Türkiye", "Turkey"],
  TM: "Turkmenistan",
  TC: "Turks and Caicos Islands",
  TV: "Tuvalu",
  UG: "Uganda",
  UA: "Ukraine",
  AE: ["United Arab Emirates", "UAE"],
  GB: ["United Kingdom", "UK", "Great Britain"],
  US: [
    "United States of America",
    "United States",
    "USA",
    "U.S.A.",
    "US",
    "U.S.",
  ],
  UM: "United States Minor Outlying Islands",
  UY: "Uruguay",
  UZ: "Uzbekistan",
  VU: "Vanuatu",
  VE: "Venezuela",
  VN: "Vietnam",
  VG: "Virgin Islands, British",
  VI: "Virgin Islands, U.S.",
  WF: "Wallis and Futuna",
  EH: "Western Sahara",
  YE: "Yemen",
  ZM: "Zambia",
  ZW: "Zimbabwe",
  AX: ["Åland Islands", "Aland Islands"],
  BQ: "Bonaire, Sint Eustatius and Saba",
  CW: "Curaçao",
  GG: "Guernsey",
  IM: "Isle of Man",
  JE: "Jersey",
  ME: "Montenegro",
  BL: "Saint Barthélemy",
  MF: "Saint Martin (French part)",
  RS: "Serbia",
  SX: "Sint Maarten (Dutch part)",
  SS: "South Sudan",
  XK: "Kosovo",
};
