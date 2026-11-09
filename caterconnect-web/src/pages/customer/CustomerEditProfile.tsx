import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Camera,
  Mail,
  MapPin,
  Save,
  UserRound,
  Phone,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../lib/supabase";
import CustomerHeader from "./CustomerHeader";
import "./CustomerProfile.css";

export default function CustomerEditProfile() {
  const { profile, session, reloadAccount } = useAuth();
  const navigate = useNavigate();
  const photoInput = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const p = profile as {
      full_name?: string | null;
      phone_number?: string | null;
      address?: string | null;
      avatar_url?: string | null;
    } | null;
    setName(p?.full_name ?? "");
    setPhone(p?.phone_number ?? "");
    setAddress(p?.address ?? "");
    setAvatar(p?.avatar_url ?? null);
  }, [profile, session?.user.id]);
  const owner = !!session?.user.id && (!profile || profile.role === "customer");
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    if (!owner || !session) {
      setError("Sign in to your customer account again.");
      return;
    }
    if (!name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (phone.trim() && !/^09\d{9}$/.test(phone.trim())) {
      setError("Enter an 11-digit Philippine mobile number beginning with 09.");
      return;
    }
    setSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim(),
          phone_number: phone.trim() || null,
          address: address.trim() || null,
        })
        .eq("id", session.user.id);
      if (updateError) throw updateError;
      await reloadAccount();
      setMessage("Profile updated successfully.");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to update profile.",
      );
    } finally {
      setSaving(false);
    }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setError("");
    setMessage("");
    const userId = session?.user.id;
    if (!userId || !owner) {
      setError("Sign in to your customer account again.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG, or WebP image.");
      return;
    }
    if (!file.size || file.size > 5 * 1024 * 1024) {
      setError("Please choose an image smaller than 5 MB.");
      return;
    }
    setUploading(true);
    try {
      // Confirm the signed-in user before uploading to their own Storage path.
      const { data: authData, error: authError } =
        await supabase.auth.getUser();
      if (authError || authData.user?.id !== userId) {
        throw new Error(
          "Your sign-in session has expired. Please sign in again.",
        );
      }
      const ext =
        file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg";
      // Follow the Mobile app: unique paths in the public `avatars` bucket.
      const path = `${userId}/avatar-${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { error: storageError } = await supabase.storage
        .from("avatars")
        .upload(path, await file.arrayBuffer(), {
          contentType: file.type,
          upsert: false,
        });
      if (storageError)
        throw new Error(`Avatar upload failed: ${storageError.message}`);

      const url = supabase.storage.from("avatars").getPublicUrl(path)
        .data.publicUrl;
      if (!url)
        throw new Error("The image uploaded, but no public URL was returned.");
      // The Mobile app updates without .select(); requiring an echoed row can
      // falsely report failure when UPDATE is allowed but SELECT is restricted.
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (updateError)
        throw new Error(`Avatar profile update failed: ${updateError.message}`);
      setAvatar(url);
      setMessage("Profile photo updated successfully.");
      // Do not report a successful avatar upload as failed if refreshing the
      // header's cached account record has a separate issue.
      try {
        await reloadAccount();
      } catch {
        setMessage(
          "Photo saved. Refresh the page if your header still shows the old image.",
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not upload profile photo.",
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className="cc-profile-shell">
      <CustomerHeader activePage="profile" />
      <main className="cc-profile-main cc-profile-narrow">
        <Link to="/customer/profile" className="cc-profile-back">
          <ArrowLeft size={17} /> Back to Profile
        </Link>
        <h1>Edit Profile</h1>
        <p className="cc-profile-subtitle">
          Update your personal information and photo.
        </p>
        {error && (
          <p className="cc-profile-error" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="cc-profile-success" role="status">
            {message}
          </p>
        )}
        <div className="cc-profile-card cc-profile-edit-photo">
          <div className="cc-profile-avatar">
            {avatar ? (
              <img src={avatar} alt="Profile avatar" />
            ) : (
              <span>{(name || "C")[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <strong>Profile Photo</strong>
            <p>Use a clear square image, up to 5 MB.</p>
            <button
              type="button"
              className="cc-profile-upload"
              disabled={uploading || !owner}
              onClick={() => photoInput.current?.click()}
            >
              <Camera size={17} /> {uploading ? "Uploading..." : "Change Photo"}
            </button>
            <input
              ref={photoInput}
              type="file"
              style={{ display: "none" }}
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading || !owner}
              onChange={(e) => {
                void upload(e.currentTarget.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
          </div>
        </div>
        <form className="cc-profile-card cc-profile-form" onSubmit={save}>
          <label>
            <span>
              <UserRound size={16} /> Full Name *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              required
              autoComplete="name"
            />
          </label>
          <label>
            <span>
              <Mail size={16} /> Email Address
            </span>
            <input
              readOnly
              value={session?.user.email ?? ""}
              title="Email changes are not available in this form"
            />
            <small>
              To protect your account, email cannot be changed here.
            </small>
          </label>
          <label>
            <span>
              <Phone size={16} /> Mobile Number
            </span>
            <input
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09XXXXXXXXX"
              maxLength={11}
              autoComplete="tel"
            />
          </label>
          <label>
            <span>
              <MapPin size={16} /> Address
            </span>
            <textarea
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your address"
              maxLength={500}
            />
          </label>
          <div className="cc-profile-form-actions">
            <button
              className="cc-profile-secondary"
              type="button"
              onClick={() => navigate("/customer/profile")}
            >
              Back
            </button>
            <button
              className="cc-profile-primary"
              type="submit"
              disabled={saving || uploading || !owner}
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
