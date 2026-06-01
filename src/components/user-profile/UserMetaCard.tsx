"use client";
import React, { useState } from "react";
import Image from "next/image";
import { Pencil, Upload, X, Crown, Shield } from "lucide-react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Label from "../form/Label";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";

function initialsOf(name: string | undefined | null): string {
  if (!name) return "U";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function roleLabel(role?: string): string {
  if (!role) return "Member";
  if (role === "SUPERADMIN") return "Superadmin";
  if (role === "ADMIN") return "Admin";
  if (role === "OPERATOR") return "Operator";
  return role;
}

export default function UserMetaCard() {
  const { user, tenant, updateProfile } = useAuth();
  const toast = useToast();
  const { isOpen, openModal, closeModal } = useModal();

  const [name, setName] = useState(user?.name ?? "");
  const [profileFile, setProfileFile] = useState<File | null>(null);
  const [profilePreview, setProfilePreview] = useState<string | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saving, setSaving] = useState(false);

  const openEdit = () => {
    setName(user?.name ?? "");
    setProfileFile(null);
    setProfilePreview(null);
    setRemoveImage(false);
    openModal();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setProfileFile(f);
    setProfilePreview(f ? URL.createObjectURL(f) : null);
    setRemoveImage(false);
  };

  const handleRemoveCurrent = () => {
    setProfileFile(null);
    setProfilePreview(null);
    setRemoveImage(true);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Name must be at least 2 characters");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        profileImage: profileFile,
        removeProfileImage: removeImage,
      });
      toast.success("Profile updated");
      closeModal();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Failed to update profile";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const displayName = user?.name ?? "—";
  const role = roleLabel(user?.role);
  const tenantName = tenant?.name ?? (user?.role === "SUPERADMIN" ? "Platform" : "—");
  const currentImage = removeImage ? null : profilePreview ?? user?.profileImage ?? null;

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="relative w-20 h-20 overflow-hidden rounded-full border border-gray-200 dark:border-gray-800 bg-yellow-100 dark:bg-yellow-500/10 flex items-center justify-center">
              {user?.profileImage ? (
                <Image
                  width={80}
                  height={80}
                  src={user.profileImage}
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-extrabold text-yellow-700 dark:text-yellow-400">
                  {initialsOf(user?.name)}
                </span>
              )}
            </div>
            <div className="order-3 xl:order-2">
              <h4 className="mb-2 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
                {displayName}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                <span className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-yellow-700 dark:text-yellow-400">
                  {user?.role === "ADMIN" || user?.role === "SUPERADMIN" ? (
                    <Crown className="w-3.5 h-3.5" />
                  ) : (
                    <Shield className="w-3.5 h-3.5" />
                  )}
                  {role}
                </span>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {tenantName}
                </p>
                {user?.email && (
                  <>
                    <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={openEdit}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 lg:inline-flex lg:w-auto"
          >
            <Pencil className="w-4 h-4" />
            Edit
          </button>
        </div>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[560px] m-4">
        <div className="no-scrollbar relative w-full overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-8">
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
              Edit profile
            </h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Your name and picture appear in the header and across the workspace.
            </p>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="flex flex-col"
          >
            <div className="px-2 pb-3 space-y-6">
              {/* Avatar */}
              <div>
                <Label>Profile picture</Label>
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-dashed border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50 flex items-center justify-center">
                    {currentImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentImage}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-extrabold text-gray-400">
                        {initialsOf(name)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
                      <Upload className="w-3.5 h-3.5" />
                      {currentImage ? "Replace" : "Upload"}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg"
                        onChange={onFileChange}
                        className="hidden"
                      />
                    </label>
                    {currentImage && (
                      <button
                        type="button"
                        onClick={handleRemoveCurrent}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                      >
                        <X className="w-3 h-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Name */}
              <div>
                <Label>Full name</Label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-theme-xs placeholder:text-gray-400 focus:outline-hidden focus:ring-3 focus:border-yellow-400 focus:ring-yellow-400/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={closeModal}
                disabled={saving}
              >
                Close
              </Button>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
