// Save input fields to local storage
function saveInputsToLocalStorage() {
  const inputs = document.querySelectorAll("input");
  inputs.forEach((input) => {
    localStorage.setItem(input.id, input.value);
  });
}

// Load input fields from local storage
function loadInputsFromLocalStorage() {
  const inputs = document.querySelectorAll("input");
  inputs.forEach((input) => {
    const savedValue = localStorage.getItem(input.id);
    if (savedValue) {
      input.value = savedValue;
    }
  });
  saveInputsToConfig();
}

// Save inputs to local storage when they lose focus
document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("blur", saveInputsToLocalStorage);
});

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

// Save input fields to config object
function saveInputsToConfig() {
  const inputs = document.querySelectorAll("input");
  inputs.forEach((input) => {
    config.set(input.id, input.value);
  });
}

// Save inputs to config object when they lose focus
document.querySelectorAll("input").forEach((input) => {
  input.addEventListener("blur", saveInputsToConfig);
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
