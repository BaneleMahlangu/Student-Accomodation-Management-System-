import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import "../../App.css";
import {
  cancelPayFastCheckout,
  getPayFastConfiguration,
  getStudentFundingPayment,
  getStudentRefundRequests,
  createStudentRefundRequest,
  makeStudentPayment,
  startPayFastCheckout,
} from "../../services/api";

import type {
  FundingPayment,
  PayFastConfiguration,
  PaymentTransaction,
  RefundRequest,
} from "../../services/api";
import { formatRentCalculation } from "../../utils/rentCalculation";


function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) =>
      letter.toUpperCase()
    );
}


function formatMoney(
  amount: string,
  currency = "ZAR"
) {
  const numericAmount = Number(amount);

  if (Number.isNaN(numericAmount)) {
    return `${currency} ${amount}`;
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(numericAmount);
}


function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "Not provided";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getLatestSuccessfulTransaction(transactions: PaymentTransaction[]) {
  return transactions
    .filter((transaction) => transaction.status === "SUCCESSFUL")
    .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())[0] ?? null;
}

function getCardNetwork(cardNumber: string): "Visa" | "Mastercard" | null {
  const digits = cardNumber.replace(/\D/g, "");
  if (digits.startsWith("4")) return "Visa";
  const twoDigitPrefix = Number(digits.slice(0, 2));
  const fourDigitPrefix = Number(digits.slice(0, 4));
  if ((digits.length >= 2 && twoDigitPrefix >= 51 && twoDigitPrefix <= 55)
    || (digits.length >= 4 && fourDigitPrefix >= 2221 && fourDigitPrefix <= 2720)) return "Mastercard";
  return null;
}

function Funding() {
  const { applicationId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [fundingPayment, setFundingPayment] =
    useState<FundingPayment | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [paying, setPaying] =
    useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");

  const [paymentError, setPaymentError] =
    useState("");
  const [cardholderName, setCardholderName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardSecurityCode, setCardSecurityCode] = useState("");
  const [cardError, setCardError] = useState("");
  const [paymentToast, setPaymentToast] = useState("");

  const [payfast, setPayfast] = useState<PayFastConfiguration | null>(null);
  const [gatewayLoading, setGatewayLoading] = useState(true);
  const [gatewayNotice, setGatewayNotice] = useState("");
  const [refundRequests, setRefundRequests] = useState<RefundRequest[]>([]);
  const [refundTransactionId, setRefundTransactionId] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundBusy, setRefundBusy] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");
  const [refundError, setRefundError] = useState("");


  useEffect(() => {
    let active = true;
    getPayFastConfiguration()
      .then((config) => { if (active) setPayfast(config); })
      .catch(() => { if (active) setPayfast(null); })
      .finally(() => { if (active) setGatewayLoading(false); });
    return () => { active = false; };
  }, []);


  useEffect(() => {
    const gatewayResult = searchParams.get("payfast");
    if (!applicationId || !gatewayResult) return;
    let active = true;

    async function refreshAfterCheckout() {
      const appId = Number(applicationId);
      if (gatewayResult === "cancelled") {
        const reference = searchParams.get("ref");
        try {
          if (reference) await cancelPayFastCheckout(appId, reference);
          const latest = await getStudentFundingPayment(appId);
          if (active) setFundingPayment(latest);
          if (active) setGatewayNotice("Checkout was cancelled. No payment was recorded.");
        } catch (err) {
          if (active) setPaymentError(err instanceof Error ? err.message : "Unable to confirm the cancelled checkout.");
        }
      } else if (gatewayResult === "return") {
        if (active) setGatewayNotice("PayFast returned you to StudentHaven. We are waiting for its secure payment confirmation.");
        for (let attempt = 0; attempt < 8 && active; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 2500));
          try {
            const latest = await getStudentFundingPayment(appId);
            if (!active) break;
            setFundingPayment(latest);
            setPaymentAmount(latest.pending_payment_amount || latest.balance);
            if (latest.payment_status === "SUCCESSFUL") {
              const settledTransaction = getLatestSuccessfulTransaction(latest.transactions);
              const sandboxResult = settledTransaction?.provider === "PAYFAST_SANDBOX";
              setGatewayNotice(sandboxResult
                ? "PayFast sandbox confirmed this test payment. No real money was transferred."
                : latest.booking_confirmed
                  ? "PayFast confirmed your payment and your accommodation booking is active."
                  : "PayFast confirmed your payment. Staff are reviewing room allocation.");
              break;
            }
            const latestTransaction = [...latest.transactions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            if (latestTransaction?.status === "SUCCESSFUL" && latest.payment_status === "PENDING") {
              setGatewayNotice(`Your installment of ${formatMoney(latestTransaction.amount, latestTransaction.currency)} was confirmed. ${formatMoney(latest.balance, latest.currency)} remains to be paid.${latest.booking_confirmed ? " Your room booking is confirmed; later rent remains due monthly." : " Pay the first rent period to confirm your room booking."}`);
              break;
            }
            if (latest.payment_status === "FAILED") {
              setGatewayNotice("PayFast did not complete this payment. You can try checkout again.");
              break;
            }
            if (attempt === 7) setGatewayNotice("Payment confirmation is still processing. This page will show the result once PayFast notifies StudentHaven.");
          } catch {
            if (attempt === 7 && active) setGatewayNotice("Payment confirmation is still processing. Refresh this page shortly to see the latest status.");
          }
        }
      }

      if (active) {
        setSearchParams((previous) => {
          previous.delete("payfast");
          previous.delete("ref");
          return previous;
        }, { replace: true });
      }
    }

    void refreshAfterCheckout();
    return () => { active = false; };
  }, [applicationId, searchParams, setSearchParams]);


  async function handlePayFastCheckout(amountOverride?: string) {
    if (!applicationId) return;
    const amount = getPaymentAmount(amountOverride);
    if (!amount) return;
    try {
      setPaying(true);
      setPaymentError("");
      const checkout = await startPayFastCheckout(Number(applicationId), amount);
      const form = document.createElement("form");
      form.method = "POST";
      form.action = checkout.checkout_url;
      form.acceptCharset = "UTF-8";
      Object.entries(checkout.form_fields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Unable to start PayFast checkout.");
      setPaying(false);
    }
  }

  async function handleMakePayment() {
    if (!fundingPayment) return;

    setPaymentError("");
    const amount = getPaymentAmount();
    if (!amount) return;

    if (gatewayLoading) {
      setPaymentError("Payment options are still loading. Please try again in a moment.");
      return;
    }

    if (payfast?.enabled) {
      await handlePayFastCheckout(amount);
      return;
    }

    if (payfast?.local_simulation_enabled) {
      await handleSimulatedCardPayment(amount);
      return;
    }

    if (!payfast?.enabled) {
      setPaymentError(`${payfast?.message || "Secure online checkout is currently unavailable."} No payment was started.`);
      return;
    }
  }

  async function handleSimulatedCardPayment(amount: string) {
    if (!applicationId || !fundingPayment) return;

    const network = getCardNetwork(cardNumber);
    const cardDigits = cardNumber.replace(/\D/g, "");
    if (!cardholderName.trim()) {
      setCardError("Enter the name shown on the test card.");
      return;
    }
    if (!network) {
      setCardError("Enter a Visa or Mastercard card number.");
      return;
    }
    if (cardDigits.length !== 16) {
      setCardError("The card number must contain exactly 16 digits.");
      return;
    }
    const expiryMatch = cardExpiry.match(/^(0[1-9]|1[0-2])\/(\d{2})$/);
    if (!expiryMatch) {
      setCardError("Enter an expiry date in MM/YY format.");
      return;
    }
    const expiryMonth = Number(expiryMatch[1]);
    const expiryYear = 2000 + Number(expiryMatch[2]);
    const now = new Date();
    if (expiryYear < now.getFullYear() || (expiryYear === now.getFullYear() && expiryMonth < now.getMonth() + 1)) {
      setCardError("The test card has expired. Enter a future expiry date.");
      return;
    }
    if (!/^\d{3}$/.test(cardSecurityCode)) {
      setCardError("Enter the 3-digit security code.");
      return;
    }

    try {
      setPaying(true);
      setCardError("");
      const updatedFunding = await makeStudentPayment(Number(applicationId), amount);
      setFundingPayment(updatedFunding);
      setPaymentAmount(updatedFunding.pending_payment_amount || updatedFunding.balance);
      setCardholderName("");
      setCardNumber("");
      setCardExpiry("");
      setCardSecurityCode("");
      const message = `Test ${network} payment of ${formatMoney(amount, fundingPayment.currency)} was recorded. No real money was charged.`;
      setGatewayNotice(message);
      setPaymentToast(message);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : "Unable to record the test card payment.");
    } finally {
      setPaying(false);
    }
  }


  useEffect(() => {
    async function loadFunding() {
      if (!applicationId) {
        setError(
          "Funding information was not found."
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const [result, requests] = await Promise.all([
          getStudentFundingPayment(Number(applicationId)),
          getStudentRefundRequests(Number(applicationId)),
        ]);

        setFundingPayment(result);
        setPaymentAmount(result.pending_payment_amount || result.balance);
        setRefundRequests(requests);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load funding information."
        );
      } finally {
        setLoading(false);
      }
    }

    loadFunding();
  }, [applicationId]);

  async function submitRefundRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const transactionId = Number(refundTransactionId || refundableTransactions[0]?.transaction.id);
    if (!applicationId || !transactionId) return;
    setRefundBusy(true);
    setRefundError("");
    setRefundMessage("");
    try {
      await createStudentRefundRequest(Number(applicationId), transactionId, refundAmount, refundReason);
      setRefundMessage("Your refund request was sent for staff review. No refund has been issued yet.");
      setRefundAmount("");
      setRefundReason("");
      setRefundRequests(await getStudentRefundRequests(Number(applicationId)));
    } catch (caught) {
      setRefundError(caught instanceof Error ? caught.message : "Unable to submit your refund request.");
    } finally {
      setRefundBusy(false);
    }
  }

  function getPaymentAmount(amountValue = paymentAmount): string | null {
    if (!fundingPayment) return null;
    const enteredAmount = amountValue.trim();
    const isValidAmountFormat = /^\d+(?:[.,]\d{1,2})?$/.test(enteredAmount);
    const amount = Number(enteredAmount.replace(",", "."));
    const balance = Number(fundingPayment.balance);
    if (!isValidAmountFormat || !Number.isFinite(amount) || amount <= 0 || amount > balance) {
      setPaymentError(`Enter an amount greater than zero and no more than ${formatMoney(fundingPayment.balance, fundingPayment.currency)}.`);
      return null;
    }
    return amount.toFixed(2);
  }

  const refundableTransactions = (fundingPayment?.transactions || []).flatMap((transaction) => {
    if (transaction.status !== "SUCCESSFUL" || transaction.provider !== "PAYFAST") return [];
    const reserved = refundRequests
      .filter((request) => request.transaction === transaction.id && ["PENDING", "APPROVED", "PROCESSING", "REFUNDED"].includes(request.status))
      .reduce((sum, request) => sum + Number(request.amount), 0);
    const available = Math.max(0, Number(transaction.amount) - reserved);
    return available > 0 ? [{ transaction, available }] : [];
  });

  const latestSuccessfulTransaction = getLatestSuccessfulTransaction(fundingPayment?.transactions || []);
  const hasLivePayFastPayment = latestSuccessfulTransaction?.provider === "PAYFAST";
  const hasSandboxPayFastPayment = latestSuccessfulTransaction?.provider === "PAYFAST_SANDBOX";
  const checkoutOption = payfast?.enabled
    ? `PayFast ${payfast.mode === "sandbox" ? "sandbox checkout" : "hosted checkout"}`
    : payfast?.local_simulation_enabled
      ? "Demo card checkout"
      : "Currently unavailable";
  const rentCalculation = fundingPayment
    ? formatRentCalculation(fundingPayment)
    : "";
  const remainingMonthsLabel = `${fundingPayment?.remaining_months ?? 0} rent ${fundingPayment?.remaining_months === 1 ? "month" : "months"} remaining`;


  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-state">
          Loading funding and payment information...
        </div>
      </div>
    );
  }


  if (error || !fundingPayment) {
    return (
      <div className="page-shell">
      <div className="error-state">
          <h1>Funding information unavailable</h1>

          <p>
            {error ||
              "We could not find your funding record."}
          </p>

          <Link
            to={
              applicationId
                ? `/applications/${applicationId}`
                : "/student/dashboard"
            }
          >
            Back to application
          </Link>
        </div>
      </div>
    );
  }


  return (
    <div className="page-shell">
      <div className="funding-page">

        <Link
          to={applicationId ? `/applications/${applicationId}` : "/student/dashboard"}
          className="funding-back-link"
        >
          ← Back to application
        </Link>

        <header className="funding-header">
          <div>
            <span className="section-eyebrow">
              STUDENTHAVEN
            </span>

            <h1>Funding & Payments</h1>

            <p>
              Manage your accommodation funding and
              payment status.
            </p>
          </div>

          <div className="funding-method-badge">
            <span>FUNDING METHOD</span>

            <strong>
              {formatStatus(
                fundingPayment.funding_method
              )}
            </strong>
          </div>
        </header>


        <section className="funding-summary-grid">

          <div className="funding-summary-card">
            <span>CONTRACT RENT TOTAL</span>

            <strong>
              {formatMoney(
                fundingPayment.amount_due,
                fundingPayment.currency
              )}
            </strong>

            <small>
              {rentCalculation}
            </small>
          </div>


          <div className="funding-summary-card">
            <span>AMOUNT PAID</span>

            <strong>
              {formatMoney(
                fundingPayment.amount_paid,
                fundingPayment.currency
              )}
            </strong>

            <small>
              Payments received
            </small>
          </div>


          <div className="funding-summary-card">
            <span>BALANCE</span>

            <strong>
              {formatMoney(
                fundingPayment.balance,
                fundingPayment.currency
              )}
            </strong>

            <small>
              {remainingMonthsLabel}
            </small>
          </div>

        </section>


        <section className="funding-card">

          <div className="funding-card-header">
            <div>
              <span className="section-eyebrow">
                FUNDING STATUS
              </span>

              <h2>Funding information</h2>
            </div>

            <span className="funding-status-badge">
              {formatStatus(
                fundingPayment.funding_status
              )}
            </span>
          </div>


          <div className="funding-information-grid">

            <div>
              <span>Funding method</span>

              <strong>
                {formatStatus(
                  fundingPayment.funding_method
                )}
              </strong>
            </div>


            <div>
              <span>Funding status</span>

              <strong>
                {formatStatus(
                  fundingPayment.funding_status
                )}
              </strong>
            </div>


            <div>
              <span>Payment status</span>

              <strong>
                {formatStatus(
                  fundingPayment.payment_status
                )}
              </strong>
            </div>


            <div>
              <span>Due date</span>

              <strong>
                {formatDate(
                  fundingPayment.due_date
                )}
              </strong>
            </div>

          </div>


          {fundingPayment.funding_notes && (
            <div className="funding-note">
              <span>FUNDING NOTES</span>

              <p>
                {fundingPayment.funding_notes}
              </p>
            </div>
          )}

        </section>


        <section className="funding-card">

          <div className="funding-card-header">
            <div>
              <span className="section-eyebrow">
                PAYMENT
              </span>

              <h2>Payment details</h2>
            </div>

            <span className="payment-status-badge">
              {formatStatus(
                fundingPayment.payment_status
              )}
            </span>
          </div>


          <div className="payment-details">

            <div className="payment-row">
              <span>Checkout option</span>
              <strong>{gatewayLoading ? "Checking available options…" : checkoutOption}</strong>
            </div>

            <div className="payment-row">
              <span>Contract rent total</span>

              <strong>
                {formatMoney(
                  fundingPayment.amount_due,
                  fundingPayment.currency
                )}
              </strong>
            </div>


            <div className="payment-row">
              <span>Amount paid</span>

              <strong>
                {formatMoney(
                  fundingPayment.amount_paid,
                  fundingPayment.currency
                )}
              </strong>
            </div>


            <div className="payment-row payment-total">
              <span>Outstanding balance</span>

              <div><strong>{formatMoney(fundingPayment.balance, fundingPayment.currency)}</strong><small>{remainingMonthsLabel}</small></div>
            </div>

          </div>


          <section className="rent-schedule" aria-labelledby="rent-schedule-title">
            <div className="rent-schedule-heading">
              <div><span className="section-eyebrow">MONTHLY RENT</span><h3 id="rent-schedule-title">Accommodation payment schedule</h3></div>
              <div><span>Monthly rate</span><strong>{formatMoney(fundingPayment.monthly_rent, fundingPayment.currency)}</strong></div>
            </div>
            <p className="rent-schedule-period">Stay: {formatDate(fundingPayment.stay_start_date)} – {formatDate(fundingPayment.stay_end_date)}. A shorter final month is charged proportionally.</p>
            <div className="rent-schedule-table-wrap"><table className="rent-schedule-table">
              <thead><tr><th>Rent period</th><th>Due</th><th>Paid</th><th>Remaining</th><th>Status</th></tr></thead>
              <tbody>{fundingPayment.rent_schedule.map((installment) => <tr key={`${installment.start_date}-${installment.end_date}`}>
                <td>{formatDate(installment.start_date)} – {formatDate(installment.end_date)}</td>
                <td>{formatMoney(installment.amount_due, fundingPayment.currency)}</td>
                <td>{formatMoney(installment.amount_paid, fundingPayment.currency)}</td>
                <td>{formatMoney(installment.balance, fundingPayment.currency)}</td>
                <td><span className={`rent-installment-status rent-installment-${installment.status.toLowerCase()}`}>{formatStatus(installment.status)}</span></td>
              </tr>)}</tbody>
            </table></div>
          </section>

          {Number(fundingPayment.amount_paid) > 0 && Number(fundingPayment.balance) > 0 && <div className="partial-payment-note" role="status"><strong>{fundingPayment.booking_confirmed ? "Room booking confirmed" : "Installment received"}</strong><span>{formatMoney(fundingPayment.amount_paid, fundingPayment.currency)} paid · {formatMoney(fundingPayment.balance, fundingPayment.currency)} left. {fundingPayment.booking_confirmed ? "Your first rent period is covered; the remaining rent is due monthly." : "Pay the remaining amount for your first rent period to confirm the room booking."} You can pay more now or pay monthly.</span></div>}

          {(fundingPayment.payment_status === "PENDING" || fundingPayment.payment_status === "FAILED" || fundingPayment.payment_status === "REFUNDED" || (fundingPayment.payment_status === "PROCESSING" && Boolean(payfast?.local_simulation_enabled) && !payfast?.enabled)) && Number(fundingPayment.balance) > 0 && (
              <div className="payment-action-area payment-required-area">

                <div>
                  <h3>{fundingPayment.payment_status === "FAILED" ? "Payment not completed" : "Payment required"}</h3>

                  <p>
                    {gatewayLoading
                      ? "Checking which payment options are available for this application."
                      : payfast?.enabled
                        ? "You’ll continue to PayFast’s hosted checkout to enter your payment details. StudentHaven does not store those details and updates your balance only after the provider confirms the payment."
                        : payfast?.local_simulation_enabled
                          ? "Enter your Visa or Mastercard test details below, then choose an amount and select Make Payment. Card details are not saved and no money will be charged."
                          : "Secure online checkout is not available right now. No payment has been started. Please contact StudentHaven support for help."}
                  </p>
                </div>

                {payfast?.enabled && <button type="button" className="primary-button" onClick={() => void handlePayFastCheckout()} disabled={paying || gatewayLoading}>
                  {paying ? "Connecting to PayFast..." : `Continue to PayFast ${payfast.mode === "sandbox" ? "sandbox" : "secure checkout"}`}
                </button>}
                {!gatewayLoading && payfast && !payfast.enabled && !payfast.local_simulation_enabled && <small>Contact StudentHaven support for payment assistance.</small>}
                {!gatewayLoading && !payfast && <small>Payment options could not be loaded. Refresh this page or contact StudentHaven support.</small>}

                {!payfast?.enabled && payfast?.local_simulation_enabled && <div className="simulated-card-fields">
                  <label>Cardholder name<input type="text" autoComplete="off" value={cardholderName} onChange={(event) => { setCardholderName(event.target.value); setCardError(""); }} placeholder="Name on card" /></label>
                  <label>Card number<div className="simulated-card-number-field"><input type="text" inputMode="numeric" autoComplete="off" maxLength={19} value={cardNumber} onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 16); setCardNumber(digits.replace(/(.{4})/g, "$1 ").trim()); setCardError(""); }} placeholder="Enter card number" /><span>{getCardNetwork(cardNumber) || "VISA / MC"}</span></div><small className="simulated-card-help">Enter exactly 16 digits. Visa starts with 4; Mastercard starts with 51–55 or 2221–2720.</small></label>
                  <div className="simulated-card-form-row">
                    <label>Expiry date<input type="text" inputMode="numeric" autoComplete="off" maxLength={5} value={cardExpiry} onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 4); setCardExpiry(digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits); setCardError(""); }} placeholder="MM/YY" /></label>
                    <label>Security code<input type="password" inputMode="numeric" autoComplete="off" maxLength={3} value={cardSecurityCode} onChange={(event) => { setCardSecurityCode(event.target.value.replace(/\D/g, "").slice(0, 3)); setCardError(""); }} placeholder="•••" /></label>
                  </div>
                  {cardError && <div className="payment-error" role="alert">{cardError}</div>}
                </div>}

              </div>
            )}

          {Number(fundingPayment.balance) > 0 && <div className="payment-amount-editor">
            <label htmlFor="payment-amount">Amount to pay</label>
            <div className="payment-amount-controls"><div><span>{fundingPayment.currency}</span><input id="payment-amount" type="number" min="0.01" max={Number(fundingPayment.balance).toFixed(2)} step="0.01" inputMode="decimal" value={paymentAmount} onChange={(event) => { setPaymentAmount(event.target.value); setPaymentError(""); }} disabled={fundingPayment.payment_status === "PROCESSING" && Boolean(payfast?.enabled)} aria-describedby="payment-amount-help" /></div><button type="button" className="payment-full-balance-button" onClick={() => void handleMakePayment()} disabled={paying || (fundingPayment.payment_status === "PROCESSING" && Boolean(payfast?.enabled))}>Make Payment</button></div>
            <small id="payment-amount-help">Pay in installments up to the outstanding balance. The room booking is confirmed after the first rent period is paid; later periods remain due monthly. Pay the full balance to settle the whole contract.</small>
            {paymentError && <div className="payment-error" role="alert">{paymentError}</div>}
          </div>}

          {gatewayNotice && <div className="funding-note" role="status" aria-live="polite"><p>{gatewayNotice}</p></div>}


          {fundingPayment.payment_status ===
            "SUCCESSFUL" && (
              <div className="payment-success-box">
                <strong>{hasLivePayFastPayment ? "PayFast payment confirmed" : hasSandboxPayFastPayment ? "PayFast sandbox test confirmed" : "Test card payment recorded"}</strong>

                <p>
                  {hasLivePayFastPayment
                    ? fundingPayment.booking_confirmed
                      ? "PayFast confirmed your payment and your accommodation booking is active."
                      : "PayFast confirmed your payment. Staff are reviewing room allocation."
                    : hasSandboxPayFastPayment
                      ? "This is a PayFast sandbox result. It did not transfer real money; any booking status shown is test data."
                      : "This simulated test card transaction was recorded. No live payment was taken."}
                </p>

                {fundingPayment.payment_reference && (
                  <small>
                    Reference:{" "}
                    {fundingPayment.payment_reference}
                  </small>
                )}
              </div>
            )}

          {fundingPayment.payment_status === "PROCESSING" && (!payfast?.local_simulation_enabled || payfast.enabled) && <div className="funding-note" role="status" aria-live="polite"><strong>Payment confirmation pending</strong><p>StudentHaven is waiting for confirmation from the payment provider. You can refresh this page to check again.</p></div>}
          {fundingPayment.payment_status === "PROCESSING" && payfast?.enabled && <div className="payment-action-area"><div><h3>Continue the same checkout</h3><p>Reopen the existing PayFast transaction if checkout was interrupted. StudentHaven will reuse its reference rather than create another payment.</p></div><button type="button" className="primary-button" onClick={() => void handlePayFastCheckout()} disabled={paying}>{paying ? "Connecting to PayFast..." : "Continue PayFast checkout"}</button></div>}

          {(refundMessage || refundError) && <div className={refundError ? "property-alert property-alert-error" : "property-alert property-alert-success"} role={refundError ? "alert" : "status"}>{refundError || refundMessage}</div>}
          {refundableTransactions.length > 0 && <form className="student-refund-form" onSubmit={submitRefundRequest}>
            <div><span className="section-eyebrow">REFUND SUPPORT</span><h3>Request a payment refund</h3><p>Staff review each request and process approved refunds through PayFast. Submitting a request does not reverse your booking or issue money automatically.</p></div>
            <label>Successful PayFast payment<select required value={refundTransactionId || String(refundableTransactions[0].transaction.id)} onChange={(event) => setRefundTransactionId(event.target.value)}>{refundableTransactions.map(({ transaction, available }) => <option key={transaction.id} value={transaction.id}>{transaction.transaction_reference} · up to {formatMoney(available.toFixed(2), transaction.currency)}</option>)}</select></label>
            <label>Amount requested<input required type="number" min="0.01" step="0.01" max={refundableTransactions.find((item) => item.transaction.id === Number(refundTransactionId))?.available ?? refundableTransactions[0].available} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} /></label>
            <label>Reason<textarea required maxLength={2000} rows={3} value={refundReason} onChange={(event) => setRefundReason(event.target.value)} placeholder="Tell staff why you are requesting the refund." /></label>
            <button className="primary-button" disabled={refundBusy}>{refundBusy ? "Submitting…" : "Send refund request"}</button>
          </form>}
          {refundRequests.length > 0 && <section className="student-refund-history" aria-label="Refund request history"><h3>Refund request history</h3>{refundRequests.map((refund) => <article key={refund.id}><div><strong>{formatMoney(refund.amount, refund.currency)} · {formatStatus(refund.status)}</strong><small>{refund.transaction_reference} · {formatDate(refund.requested_at)}</small></div><p>{refund.reason}</p>{refund.review_note && <small>Staff update: {refund.review_note}</small>}</article>)}</section>}

          {fundingPayment.transactions.length > 0 && (
            <div className="payment-history">

              <div className="funding-card-header">
                <div>
                  <span className="section-eyebrow">
                    PAYMENT HISTORY
                  </span>

                  <h2>Transactions</h2>
                </div>
              </div>

              {fundingPayment.transactions.map(
                (transaction) => (
                  <div
                    className="payment-history-row"
                    key={transaction.id}
                  >
                    <div>
                      <strong>
                        {formatMoney(
                          transaction.amount,
                          transaction.currency
                        )}
                      </strong>

                      <small>
                        {transaction.transaction_reference}
                      </small>
                    </div>

                    <span className="payment-status-badge">
                      {formatStatus(
                        transaction.status
                      )}
                    </span>
                  </div>
                )
              )}

            </div>
          )}


        </section>


        {paymentToast && <div className="payment-success-toast" role="status" aria-live="polite"><div><strong>Payment recorded</strong><button type="button" onClick={() => setPaymentToast("")} aria-label="Dismiss payment notification">×</button></div><p>{paymentToast}</p></div>}

        <div className="funding-footer-actions">

          <Link
            to={
              applicationId
                ? `/applications/${applicationId}`
                : "/student/dashboard"
            }
            className="secondary-button"
          >
            Back to Application
          </Link>

          <Link
            to={
              applicationId
                ? `/contracts/${applicationId}`
                : "/student/dashboard"
            }
            className="secondary-button"
          >
            View Contract
          </Link>

        </div>

      </div>
    </div>
  );
}

export default Funding;
