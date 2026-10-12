import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import {
    getCurrentUser,
    getStudentProfilePhoto,
    uploadStudentProfilePhoto,
    deleteStudentProfilePhoto,
    updateStudentProfile,
} from "../../services/api";

export default function Profile() {

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const [successMessage, setSuccessMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [photoBusy, setPhotoBusy] = useState(false);

    const [form, setForm] = useState({
        first_name: "",
        last_name: "",
        email: "",
        mobile: "",
        student_number: "",
        university: "",
        campus: "",
        course: "",
        year_of_study: "",
        date_of_birth: "",
        emergency_contact_name: "",
        emergency_contact_phone: "",
        accessibility_requirements: "",
    });

    useEffect(() => {

        async function loadProfile() {

            try {

                const user = await getCurrentUser();

                const profile = user.student_profile;

                if (!profile) {
                    throw new Error(
                        "Student profile information was not found."
                    );
                }

                setForm({
                    first_name: user.first_name || "",
                    last_name: user.last_name || "",
                    email: user.email || "",
                    mobile: user.mobile || "",
                    student_number:
                        profile.student_number || "",
                    university:
                        profile.university || "",
                    campus:
                        profile.campus || "",
                    course:
                        profile.course || "",
                    year_of_study:
                        profile.year_of_study !== null &&
                            profile.year_of_study !== undefined
                            ? String(profile.year_of_study)
                            : "",
                    date_of_birth:
                        profile.date_of_birth || "",
                    emergency_contact_name:
                        profile.emergency_contact_name || "",
                    emergency_contact_phone:
                        profile.emergency_contact_phone || "",
                    accessibility_requirements:
                        profile.accessibility_requirements || "",
                });

            } catch (error) {

                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Unable to load your profile."
                );

            } finally {

                setLoading(false);
            }
        }

        loadProfile();

    }, []);

    useEffect(() => {
        getStudentProfilePhoto().then((photo) => setPhotoUrl(photo.photo_url)).catch((error) => {
            setErrorMessage(error instanceof Error ? error.message : "Unable to load your profile photo.");
        });
    }, []);

    async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        setPhotoBusy(true); setErrorMessage(""); setSuccessMessage("");
        try {
            const result = await uploadStudentProfilePhoto(file);
            setPhotoUrl(result.photo_url ? `${result.photo_url}?v=${Date.now()}` : null);
            setSuccessMessage("Profile photo updated. Image metadata was removed when it was saved.");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to upload your profile photo.");
        } finally { setPhotoBusy(false); }
    }

    async function handleRemovePhoto() {
        setPhotoBusy(true); setErrorMessage(""); setSuccessMessage("");
        try {
            await deleteStudentProfilePhoto();
            setPhotoUrl(null);
            setSuccessMessage("Profile photo removed.");
        } catch (error) {
            setErrorMessage(error instanceof Error ? error.message : "Unable to remove your profile photo.");
        } finally { setPhotoBusy(false); }
    }

    function handleChange(
        event: React.ChangeEvent<
            HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
        >
    ) {

        const { name, value } = event.target;

        setForm((current) => ({
            ...current,
            [name]: value,
        }));
    }

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {

        event.preventDefault();

        setSaving(true);
        setSuccessMessage("");
        setErrorMessage("");

        try {

            const updatedUser =
                await updateStudentProfile({
                    first_name: form.first_name.trim(),
                    last_name: form.last_name.trim(),
                    mobile: form.mobile.trim(),
                    university: form.university.trim(),
                    campus: form.campus.trim(),
                    course: form.course.trim(),
                    year_of_study:
                        form.year_of_study
                            ? Number(form.year_of_study)
                            : null,
                    date_of_birth: form.date_of_birth,
                    emergency_contact_name:
                        form.emergency_contact_name.trim(),
                    emergency_contact_phone:
                        form.emergency_contact_phone.trim(),
                    accessibility_requirements:
                        form.accessibility_requirements.trim(),
                });

            const profile =
                updatedUser.student_profile;

            if (profile) {

                setForm((current) => ({
                    ...current,
                    first_name:
                        updatedUser.first_name || "",
                    last_name:
                        updatedUser.last_name || "",
                    mobile:
                        updatedUser.mobile || "",
                    university:
                        profile.university || "",
                    campus:
                        profile.campus || "",
                    course:
                        profile.course || "",
                    year_of_study:
                        profile.year_of_study !== null &&
                            profile.year_of_study !== undefined
                            ? String(profile.year_of_study)
                            : "",
                    date_of_birth:
                        profile.date_of_birth || "",
                    emergency_contact_name:
                        profile.emergency_contact_name || "",
                    emergency_contact_phone:
                        profile.emergency_contact_phone || "",
                    accessibility_requirements:
                        profile.accessibility_requirements || "",
                }));
            }

            setSuccessMessage(
                profile?.profile_completed
                    ? "Profile completed successfully."
                    : "Profile updated successfully."
            );

        } catch (error) {

            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Unable to update your profile."
            );

        } finally {

            setSaving(false);
        }
    }

    if (loading) {

        return (
            <main className="profile-page">
                <div className="profile-card">
                    <p>Loading your profile...</p>
                </div>
            </main>
        );
    }

    return (
        <main className="profile-page">

            <section className="profile-header">
                <div>
                    <Link className="page-return-link" to="/student/dashboard">← Back to dashboard</Link>
                    <p className="profile-eyebrow">
                        STUDENTHAVEN
                    </p>

                    <h1>My Profile</h1>

                    <p>
                        Keep your student information accurate and
                        up to date.
                    </p>
                    <Link className="profile-security-link" to="/account/security">Manage account security</Link>
                    <Link className="profile-security-link" to="/account/notifications">Manage email notifications</Link>
                    <Link className="profile-security-link" to="/student/recommendations">Accommodation preferences</Link>
                    <Link className="profile-security-link" to="/student/privacy">Privacy settings</Link>
                </div>
            </section>

            {successMessage && (
                <div className="profile-message profile-success">
                    {successMessage}
                </div>
            )}

            {errorMessage && (
                <div className="profile-message profile-error">
                    {errorMessage}
                </div>
            )}

            <section className="profile-card profile-photo-card" aria-label="Profile photo">
                {photoUrl ? <img src={photoUrl} crossOrigin="use-credentials" alt="Your profile" className="profile-photo-preview" /> : <div className="profile-photo-placeholder" aria-hidden="true">{form.first_name.charAt(0)}{form.last_name.charAt(0)}</div>}
                <div className="profile-photo-copy"><h2>Profile photo</h2><p>Upload a JPG, PNG or WebP image up to 3 MB. Images are resized, stripped of location metadata and served only to your signed-in account.</p><div className="profile-photo-actions"><label className="dashboard-secondary-action profile-photo-upload">{photoBusy ? "Saving…" : photoUrl ? "Change photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={(event) => void handlePhotoChange(event)} /></label>{photoUrl && <button type="button" className="dashboard-secondary-action" disabled={photoBusy} onClick={() => void handleRemovePhoto()}>Remove photo</button>}</div></div>
            </section>

            <form
                className="profile-card"
                onSubmit={handleSubmit}
            >

                <div className="profile-section">
                    <h2>Personal Information</h2>

                    <div className="profile-grid">

                        <label>
                            First Name
                            <input
                                name="first_name"
                                value={form.first_name}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Last Name
                            <input
                                name="last_name"
                                value={form.last_name}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Email
                            <input
                                value={form.email}
                                disabled
                            />
                        </label>

                        <label>
                            Mobile Number
                            <input
                                name="mobile"
                                value={form.mobile}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Date of Birth
                            <input
                                type="date"
                                name="date_of_birth"
                                value={form.date_of_birth}
                                onChange={handleChange}
                                required
                            />
                        </label>

                    </div>
                </div>

                <div className="profile-section">
                    <h2>Academic Information</h2>

                    <div className="profile-grid">

                        <label>
                            Student Number
                            <input
                                value={form.student_number}
                                disabled
                            />
                            <small>
                                Your official student number cannot be changed here.
                            </small>
                        </label>

                        <label>
                            University
                            <input
                                name="university"
                                value={form.university}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Campus
                            <input
                                name="campus"
                                value={form.campus}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Course
                            <input
                                name="course"
                                value={form.course}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Year of Study
                            <select
                                name="year_of_study"
                                value={form.year_of_study}
                                onChange={handleChange}
                                required
                            >
                                <option value="">
                                    Select year
                                </option>

                                <option value="1">
                                    Year 1
                                </option>

                                <option value="2">
                                    Year 2
                                </option>

                                <option value="3">
                                    Year 3
                                </option>

                                <option value="4">
                                    Year 4
                                </option>

                                <option value="5">
                                    Year 5
                                </option>
                            </select>
                        </label>

                    </div>
                </div>

                <div className="profile-section">
                    <h2>Emergency Contact</h2>

                    <div className="profile-grid">

                        <label>
                            Contact Name
                            <input
                                name="emergency_contact_name"
                                value={
                                    form.emergency_contact_name
                                }
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Contact Phone
                            <input
                                name="emergency_contact_phone"
                                value={
                                    form.emergency_contact_phone
                                }
                                onChange={handleChange}
                                required
                            />
                        </label>

                    </div>
                </div>

                <div className="profile-section">
                    <h2>Accessibility requirements</h2>
                    <p>Share only the accommodation details needed to help staff find a suitable room.</p>
                    <div className="profile-grid">
                        <label className="profile-form-wide">
                            Access needs or adjustments
                            <textarea
                                name="accessibility_requirements"
                                value={form.accessibility_requirements}
                                onChange={handleChange}
                                maxLength={4000}
                                rows={4}
                                placeholder="Optional. For example, step-free access or an adapted bathroom."
                            />
                        </label>
                    </div>
                </div>

                <div className="profile-actions">

                    <button
                        type="submit"
                        disabled={saving}
                        className="profile-save-button"
                    >
                        {saving
                            ? "Saving..."
                            : "Save Changes"}
                    </button>

                </div>

            </form>

        </main>
    );
}
