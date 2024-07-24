// Save input fields to local storage
function saveInputsToLocalStorage() {
  const inputs = document.querySelectorAll("input, select"); // Include select boxes
  inputs.forEach((input) => {
    if (input.type === "checkbox") {
      localStorage.setItem(input.id, input.checked ? "true" : "false");
    } else {
      localStorage.setItem(input.id, input.value);
    }
  });
}

// Load input fields from local storage
function loadInputsFromLocalStorage() {
  const inputs = document.querySelectorAll("input, select"); // Include select boxes
  inputs.forEach((input) => {
    const savedValue = localStorage.getItem(input.id);
    if (savedValue !== null) {
      if (input.type === "checkbox") {
        input.checked = savedValue === "true";
      } else {
        input.value = savedValue;
      }
    }
  });
  saveInputsToConfig();
}

// Load inputs from local storage when the page loads
window.addEventListener("load", loadInputsFromLocalStorage);

let config = {
  values: {},
  get: function (key) {
    return this.values[key];
  },
  set: function (key, value) {
    this.values[key] = value;
  },
};

function saveInputsToConfig() {
  const inputs = document.querySelectorAll("input, select");
  inputs.forEach((input) => {
    if (input.type === "checkbox") {
      config.set(input.id, input.checked ? "true" : "false");
    } else {
      config.set(input.id, input.value);
    }
  });
  saveInputsToLocalStorage();
}

// Save inputs to config object when they lose focus
document.addEventListener("DOMContentLoaded", function () {
  document.querySelectorAll("input, select").forEach((input) => {
    if (input.type === "checkbox" || input.type === "select-one") {
      input.addEventListener("change", saveInputsToConfig);
    } else {
      input.addEventListener("blur", saveInputsToConfig);
    }
  });

  document
    .getElementById("test_transaction")
    .addEventListener("change", function () {
      saveInputsToConfig();
    });
});

function showAlert(message, duration, error = false) {
  const alertToast = document.getElementById("alert-toast");
  const alertMessage = document.getElementById("alert-message");

  // Set the message and show the alert
  alertMessage.textContent = message;
  alertToast.style.opacity = "1";
  backgroundColor = error ? "bg-red-500" : "bg-green-500";
  alertToast.classList.remove("bg-red-500", "bg-green-500");
  alertToast.classList.add(backgroundColor);
  // Hide the alert after the duration
  setTimeout(() => {
    alertToast.style.opacity = "0";
  }, duration);
}

// Load inputs from config object when the page loads
