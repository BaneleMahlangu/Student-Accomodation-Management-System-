import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import "../../App.css";

import {
  getStudentContract,
  signStudentContract,
} from "../../services/api";

import type {
  StudentContract,
} from "../../services/api";


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


function formatDateTime(dateValue: string | null) {
  if (!dateValue) {
    return "Not signed";
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleString("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}


function formatStatus(status: string) {
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}


function Contract() {
  const { applicationId } = useParams();

  const [contract, setContract] =
    useState<StudentContract | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [signing, setSigning] =
    useState(false);

  const [signError, setSignError] =
    useState("");

  const [signatureName, setSignatureName] = useState("");

  const [signatureConfirmed, setSignatureConfirmed] = useState(false);

  async function handleSignContract() {
    if (!applicationId) {
      return;
    }

    if (!signatureConfirmed || signatureName.trim().toLocaleLowerCase() !== contract?.student_name.trim().toLocaleLowerCase()) {
      setSignError("Type your full account name and confirm that you have reviewed the agreement.");
      return;
    }

    try {
      setSigning(true);
      setSignError("");

      const updatedContract =
        await signStudentContract(
          Number(applicationId),
          signatureName.trim(),
          signatureConfirmed
        );

      setContract(updatedContract);
    } catch (err) {
      setSignError(
        err instanceof Error
          ? err.message
          : "Unable to sign contract."
      );
    } finally {
      setSigning(false);
    }
  }


  useEffect(() => {
    async function loadContract() {
      if (!applicationId) {
        setError("Contract was not found.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const result =
          await getStudentContract(
            Number(applicationId)
          );

        setContract(result);
        setSignatureName(result.student_name);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load contract."
        );
      } finally {
        setLoading(false);
      }
    }

    loadContract();
  }, [applicationId]);


  if (loading) {
    return (
      <div className="page-shell">
        <div className="loading-state">
          Loading your contract...
        </div>
      </div>
    );
  }


  if (error || !contract) {
    return (
      <div className="page-shell">
        <div className="error-state">
          <h1>Contract unavailable</h1>

          <p>
            {error || "We could not find your contract."}
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
      <div className="contract-page">

        <Link
          to={applicationId ? `/applications/${applicationId}` : "/student/dashboard"}
          className="contract-back-link"
        >
          ← Back to application
        </Link>

        <div className="contract-header">
          <div>
            <span className="section-eyebrow">
              STUDENTHAVEN
            </span>

            <h1>Accommodation Contract</h1>

            <p>
              Review your residence agreement before
              proceeding to the next stage.
            </p>
          </div>

          <div className="contract-status">
            <span>STATUS</span>

            <strong>
              {formatStatus(contract.status)}
            </strong>
          </div>
        </div>


        <section className="contract-card">

          <div className="contract-card-header">
            <div>
              <span className="section-eyebrow">
                CONTRACT DETAILS
              </span>

              <h2>
                {contract.contract_number}
              </h2>
            </div>
          </div>


          <div className="contract-info-grid">

            <div>
              <span>Property</span>
              <strong>
                {contract.property_name}
              </strong>
            </div>

            <div>
              <span>Room</span>
              <strong>
                {contract.room_number}
              </strong>
            </div>

            <div>
              <span>Start date</span>
              <strong>
                {formatDate(contract.start_date)}
              </strong>
            </div>

            <div>
              <span>End date</span>
              <strong>
                {formatDate(contract.end_date)}
              </strong>
            </div>

            <div>
              <span>Monthly fee</span>
              <strong>
                R{" "}
                {Number(
                  contract.monthly_fee
                ).toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                })}
              </strong>
            </div>

            <div>
              <span>Signed</span>
              <strong>
                {formatDateTime(
                  contract.signed_at
                )}
              </strong>
            </div>

          </div>
        </section>


        <section className="contract-card">

          <div className="contract-card-header">
            <div>
              <span className="section-eyebrow">
                AGREEMENT
              </span>

              <h2>Terms and conditions</h2>
            </div>
          </div>

          <div className="contract-document">

            <div>
              <h3>Terms</h3>

              <p>
                {contract.terms ||
                  " terms have been provided to your email."}
              </p>
            </div>


            <div>
              <h3>Residence rules</h3>

              <p>
                {contract.rules ||
                  "residence rules have been sent to your email."}
              </p>
            </div>


            <div>
              <h3>Cancellation policy</h3>

              <p>
                {contract.cancellation_policy ||
                  "No additional cancellation policy has been provided."}
              </p>
            </div>

          </div>
        </section>


        {contract.status === "PENDING_SIGNATURE" && (
          <section className="contract-sign-card">

            <div>
              <span className="section-eyebrow">
                ACTION REQUIRED
              </span>

              <h2>
                Your contract is ready for signature
              </h2>

              <p>
                Review the agreement carefully before
                entering your typed name and confirmation.
              </p>
            </div>

            <div className="contract-esign-fields">
              <label htmlFor="contract-signature-name">Type your full name</label>
              <input id="contract-signature-name" autoComplete="name" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
              <label className="contract-esign-consent">
                <input type="checkbox" checked={signatureConfirmed} onChange={(event) => setSignatureConfirmed(event.target.checked)} />
                <span>I have reviewed the terms, residence rules and cancellation policy, and agree to sign this contract electronically.</span>
              </label>
              <small>StudentHaven records the typed name, confirmation and signing time with this contract.</small>
            </div>

            {signError && (
              <div className="contract-sign-error">
                {signError}
              </div>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={handleSignContract}
              disabled={signing || !signatureConfirmed || signatureName.trim().toLocaleLowerCase() !== contract.student_name.trim().toLocaleLowerCase()}
            >
              {signing ? "Signing Contract..." : "Sign Contract"}
            </button>

          </section>
        )}


        {contract.status === "SIGNED" && (
          <section className="contract-signed-card">

            <strong>
              Contract signed
            </strong>

            <p>
              Your accommodation contract was signed on{" "}
              {formatDateTime(contract.signed_at)}.
            </p>
            {contract.signature_name && <p>Signed electronically by <strong>{contract.signature_name}</strong>.</p>}

          </section>
        )}


        <div className="contract-footer-actions">

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

        </div>

      </div>
    </div>
  );
}

export default Contract;
