"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { trackEvent } from "../../lib/analytics";
import { requestSignIn } from "../../lib/auth-navigation";
import { ModelPicker, type ModelPickerOption } from "./model-picker";
import { StudioIcon } from "./studio-navigation";
import { StudioSelectField } from "./studio-primitives";
import Link from "./studio-link";
import {
  PET_APP_DEFAULT_PROVIDER,
  PET_APP_ID,
  PET_APP_PROVIDER_IDS,
  PET_SING_DANCE_TEMPLATES,
  estimatePetAppCredits,
  normalizePetAppDuration,
  normalizePetAppResolution,
  petAppDurationsForProvider,
  petAppProviderLabel,
  petAppRatioForProvider,
  petAppResolutionsForProvider,
  petAppTemplateById,
  type PetAppProviderId,
  type PetSingDanceTemplate,
  type PetTemplateCategory
} from "./studio-apps-catalog";
import { studioAppsCopy } from "./studio-apps-i18n";
import {
  clearPersistentIdempotency,
  createIdempotencyFingerprint,
  getPersistentIdempotency,
  pickImageOutputUrls,
  pickMediaUrl,
  type TaskItem
} from "./studio-storage";
import {
  PROVIDER_META,
  frontendPollAttempts,
  modelPickerBadge,
  modelPickerGroup,
  modelPickerSpeedKey,
  studioProjectHref
} from "./studio-workspace-config";
import { uploadStudioDataUrl, uploadStudioMedia } from "./upload-studio-media";
import type { StudioController } from "./use-studio-controller";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;

function isPetAppTask(task: TaskItem) {
  return task.type === "Video" && task.settings?.studioApp === PET_APP_ID;
}

function ExpandIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6" />
      <path d="M9 21H3v-6" />
      <path d="m21 3-7 7" />
      <path d="m3 21 7-7" />
    </svg>
  );
}

function StudioAppsHub({ model }: { model: StudioController }) {
  const copy = studioAppsCopy(model.studioI18n.locale);
  const previewTiles = useMemo(
    () => [
      petAppTemplateById("tiktok-shuffle"),
      petAppTemplateById("disco-paw"),
      petAppTemplateById("pop-star-sing"),
      petAppTemplateById("opera-diva")
    ],
    []
  );

  return (
    <div className="df-apps-shell" data-studio-apps-hub>
      <div className="df-apps-hub-header">
        <h2>{copy.hubTitle}</h2>
        <p>{copy.hubSubtitle}</p>
      </div>

      <section className="df-apps-featured">
        <div>
          <span className="df-apps-featured-eyebrow">
            <StudioIcon name="sparkles" className="h-3.5 w-3.5" />
            <span>{copy.hubFeaturedTag}</span>
          </span>
          <h3>{copy.petAppTitle}</h3>
          <p>{copy.petAppDescription}</p>
          <div className="df-apps-featured-pills">
            <span className="df-apps-featured-pill">{copy.stepPhoto}</span>
            <span className="df-apps-featured-pill">{copy.stepTemplate}</span>
            <span className="df-apps-featured-pill">{copy.stageAudioBadge}</span>
          </div>
          <div className="df-apps-featured-actions">
            <Link href="/studio?view=apps&app=pet-sing-dance" className="df-apps-primary-cta" data-open-pet-app>
              <StudioIcon name="sparkles" className="h-4 w-4" />
              <span>{copy.hubOpenApp}</span>
              <StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>

        <div className="df-apps-featured-visual">
          {previewTiles.map((tpl) => (
            <Link key={tpl.id} href="/studio?view=apps&app=pet-sing-dance" className="df-apps-preview-tile">
              <img src={tpl.coverUrl} alt={copy.templates[tpl.id].title} loading="lazy" />
              <div className="df-apps-preview-tile-scrim">
                <strong>{copy.templates[tpl.id].title}</strong>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="df-apps-grid" aria-label={copy.hubTitle}>
        <Link href="/studio?mode=audio&workflow=text-to-audio&provider=elevenlabs-tts" className="df-apps-card" data-open-voice-app>
          <div>
            <div className="df-apps-card-top">
              <span className="df-apps-card-icon" aria-hidden="true">
                <StudioIcon name="audio" className="h-5 w-5" />
              </span>
              <span className="df-apps-card-badge">{copy.voiceAppBadge}</span>
            </div>
            <h3 className="mt-3.5">{copy.voiceAppTitle}</h3>
            <p>{copy.voiceAppDescription}</p>
          </div>
          <span className="df-apps-card-link">
            <span>{copy.hubOpenApp}</span>
            <StudioIcon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
          </span>
        </Link>

        <article className="df-apps-card df-apps-card--soon" aria-disabled="true">
          <div>
            <div className="df-apps-card-top">
              <span className="df-apps-card-icon" aria-hidden="true">
                <StudioIcon name="wand" className="h-5 w-5" />
              </span>
              <span className="df-apps-card-badge">{copy.hubComingSoon}</span>
            </div>
            <h3 className="mt-3.5">{copy.comingOutfitTitle}</h3>
            <p>{copy.comingOutfitDescription}</p>
          </div>
        </article>

        <article className="df-apps-card df-apps-card--soon" aria-disabled="true">
          <div>
            <div className="df-apps-card-top">
              <span className="df-apps-card-icon" aria-hidden="true">
                <StudioIcon name="video" className="h-5 w-5" />
              </span>
              <span className="df-apps-card-badge">{copy.hubComingSoon}</span>
            </div>
            <h3 className="mt-3.5">{copy.comingBabyTitle}</h3>
            <p>{copy.comingBabyDescription}</p>
          </div>
        </article>
      </section>
    </div>
  );
}

function PetSingDanceWorkbench({ model }: { model: StudioController }) {
  const {
    accessToken,
    cacheCreditBalance,
    cloudMediaEnabled,
    creditBalance,
    localizeStudioError,
    pricingTime,
    refreshLiveAccessToken,
    setBillingGenerationContext,
    setBillingModalOpen,
    setCreditBalance,
    setPricingTime,
    setTasks,
    st,
    studioI18n,
    tasks,
    userId
  } = model;

  const copy = studioAppsCopy(studioI18n.locale);
  const [petPhoto, setPetPhoto] = useState<{ dataUrl: string; name: string; file: File; uploadedUrl?: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [rightTab, setRightTab] = useState<"templates" | "creations">("templates");
  const [category, setCategory] = useState<"all" | PetTemplateCategory>("all");
  const [templateId, setTemplateId] = useState<PetSingDanceTemplate["id"]>(PET_SING_DANCE_TEMPLATES[0].id);
  const [previewTemplate, setPreviewTemplate] = useState<PetSingDanceTemplate | null>(null);
  const [provider, setProvider] = useState<PetAppProviderId>(PET_APP_DEFAULT_PROVIDER);
  const [duration, setDuration] = useState<string>("5s");
  const [resolution, setResolution] = useState<string>("480p");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const galleryRef = useRef<HTMLElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const uploadSeqRef = useRef(0);
  const unmountedRef = useRef(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      uploadSeqRef.current += 1;
    };
  }, []);

  const selectedTemplate = useMemo(() => petAppTemplateById(templateId), [templateId]);
  const visibleTemplates = useMemo(
    () => (category === "all" ? PET_SING_DANCE_TEMPLATES : PET_SING_DANCE_TEMPLATES.filter((item) => item.category === category)),
    [category]
  );

  const previewList = useMemo(
    () => (previewTemplate && visibleTemplates.some((item) => item.id === previewTemplate.id) ? visibleTemplates : PET_SING_DANCE_TEMPLATES),
    [previewTemplate, visibleTemplates]
  );
  const previewIndex = useMemo(
    () => (previewTemplate ? previewList.findIndex((item) => item.id === previewTemplate.id) : -1),
    [previewList, previewTemplate]
  );

  const stepPreview = useCallback(
    (delta: number) => {
      if (previewIndex < 0 || previewList.length <= 1) return;
      const next = (previewIndex + delta + previewList.length) % previewList.length;
      setPreviewTemplate(previewList[next]);
    },
    [previewIndex, previewList]
  );

  useEffect(() => {
    if (!previewTemplate) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewTemplate(null);
      else if (event.key === "ArrowLeft") stepPreview(-1);
      else if (event.key === "ArrowRight") stepPreview(1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [previewTemplate, stepPreview]);

  const handleOpenTemplatePicker = useCallback(() => {
    setRightTab("templates");
    requestAnimationFrame(() => {
      galleryRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const durationOptions = useMemo(() => petAppDurationsForProvider(provider), [provider]);
  const resolutionOptions = useMemo(() => petAppResolutionsForProvider(provider), [provider]);
  const resolvedDuration = useMemo(() => normalizePetAppDuration(provider, duration), [provider, duration]);
  const resolvedResolution = useMemo(() => normalizePetAppResolution(provider, resolution), [provider, resolution]);
  const ratio = useMemo(() => petAppRatioForProvider(provider), [provider]);

  const estimatedCredits = useMemo(
    () =>
      estimatePetAppCredits({
        provider,
        duration: resolvedDuration,
        resolution: resolvedResolution,
        pricingTime
      }),
    [provider, resolvedDuration, resolvedResolution, pricingTime]
  );

  const petModelPickerOptions = useMemo<ModelPickerOption[]>(
    () =>
      PET_APP_PROVIDER_IDS.map((pid) => {
        const meta = PROVIDER_META[pid] || {
          label: petAppProviderLabel(pid),
          shortLabel: petAppProviderLabel(pid),
          speed: "Fast",
          quality: "Native audio",
          bestFor: ""
        };
        const optionDuration = normalizePetAppDuration(pid, resolvedDuration);
        const optionResolution = normalizePetAppResolution(pid, resolvedResolution);
        const optionCredits =
          pid === provider
            ? estimatedCredits
            : estimatePetAppCredits({
                provider: pid,
                duration: optionDuration,
                resolution: optionResolution,
                pricingTime
              });
        const badgeKey = modelPickerBadge("video", pid, PET_APP_DEFAULT_PROVIDER);
        const speedKey = modelPickerSpeedKey(meta.speed);
        return {
          value: pid,
          label: meta.label,
          description: meta.bestFor,
          speed: speedKey ? st(speedKey) : meta.speed,
          quality: meta.quality,
          duration: optionDuration,
          credits: optionCredits,
          badge: badgeKey ? st(badgeKey) : undefined,
          group: st(modelPickerGroup("video", "image-to-video", pid, PET_APP_DEFAULT_PROVIDER)),
          capabilities: ["audio"]
        };
      }),
    [estimatedCredits, pricingTime, provider, resolvedDuration, resolvedResolution, st]
  );

  const recentPetTasks = useMemo(() => tasks.filter(isPetAppTask).slice(0, 12), [tasks]);
  const runningPetCount = useMemo(
    () => recentPetTasks.filter((task) => task.status === "Queued" || task.status === "Running").length,
    [recentPetTasks]
  );
  const activeTask = useMemo(() => {
    if (activeTaskId) return tasks.find((task) => task.id === activeTaskId) || null;
    return recentPetTasks[0] || null;
  }, [activeTaskId, recentPetTasks, tasks]);

  const handleSelectProvider = useCallback((nextProvider: PetAppProviderId) => {
    setProvider(nextProvider);
    setDuration((prev) => normalizePetAppDuration(nextProvider, prev));
    setResolution((prev) => normalizePetAppResolution(nextProvider, prev));
  }, []);

  const handleSelectTemplate = useCallback(
    (tpl: PetSingDanceTemplate, scrollToControls = false) => {
      setTemplateId(tpl.id);
      setDuration(normalizePetAppDuration(provider, tpl.recommendedDuration));
      setErrorMessage("");
      if (scrollToControls && typeof window !== "undefined" && window.innerWidth <= 1024) {
        requestAnimationFrame(() => {
          railRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    },
    [provider]
  );

  const readPetFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      const seq = ++uploadSeqRef.current;
      setErrorMessage("");
      if (!ALLOWED_IMAGE_TYPES.has(file.type) || file.size > MAX_IMAGE_BYTES) {
        setErrorMessage(copy.uploadInvalid);
        return;
      }
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("read")));
          reader.onerror = () => reject(reader.error || new Error("read"));
          reader.readAsDataURL(file);
        });
        if (seq === uploadSeqRef.current && !unmountedRef.current) {
          setPetPhoto({ dataUrl, name: file.name, file });
          setStatusMessage("");
        }
      } catch {
        if (seq === uploadSeqRef.current && !unmountedRef.current) {
          setErrorMessage(copy.uploadFailed);
        }
      }
    },
    [copy.uploadFailed, copy.uploadInvalid]
  );

  const handleGenerate = useCallback(async () => {
    if (submitLockRef.current) return;
    setErrorMessage("");
    setStatusMessage("");

    if (!petPhoto) {
      setErrorMessage(copy.uploadRequired);
      return;
    }

    if (typeof creditBalance === "number" && creditBalance < estimatedCredits) {
      setBillingGenerationContext({
        requiredCredits: estimatedCredits,
        balance: creditBalance,
        providerLabel: petAppProviderLabel(provider)
      });
      setBillingModalOpen(true);
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);
    let idempotencyStorageKey: string | null = null;

    try {
      const liveToken = await refreshLiveAccessToken();
      if (!liveToken) {
        trackEvent("generate_login_required", { mode: "video", provider, workflow: "image-to-video", studio_app: PET_APP_ID }, accessToken);
        requestSignIn({
          onSuccess: () => {
            if (!unmountedRef.current) setStatusMessage("");
          }
        });
        return;
      }

      const requestPayload = {
        mode: "video" as const,
        videoWorkflow: "image-to-video" as const,
        provider,
        ratio,
        duration: resolvedDuration,
        resolution: resolvedResolution,
        generateAudio: true,
        prompt: selectedTemplate.prompt,
        imageUrls: [petPhoto.dataUrl],
        expectedCredits: estimatedCredits
      };

      const fingerprint = createIdempotencyFingerprint({
        ...requestPayload,
        studioApp: PET_APP_ID,
        templateId: selectedTemplate.id
      });
      const idempotency = getPersistentIdempotency(userId, fingerprint);
      idempotencyStorageKey = idempotency.storageKey;

      const uploadedUrl = petPhoto.uploadedUrl
        ? petPhoto.uploadedUrl
        : cloudMediaEnabled
          ? (await uploadStudioMedia(petPhoto.file, "image", liveToken)) ?? (await uploadStudioDataUrl(petPhoto.dataUrl, "image", liveToken))
          : petPhoto.dataUrl;
      if (uploadedUrl && uploadedUrl !== petPhoto.dataUrl && !unmountedRef.current) {
        setPetPhoto((current) => (current && current.dataUrl === petPhoto.dataUrl ? { ...current, uploadedUrl } : current));
      }
      const uploadedUrls = [uploadedUrl];

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${liveToken}`
        },
        body: JSON.stringify({
          ...requestPayload,
          imageUrls: uploadedUrls,
          idempotencyKey: idempotency.idempotencyKey
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: string;
          code?: string;
          pricingTime?: number;
          refundedCredits?: number;
          balance?: number | null;
        } | null;
        if (response.status < 500 || errorPayload?.code === "provider_not_submitted" || typeof errorPayload?.refundedCredits === "number") {
          clearPersistentIdempotency(idempotencyStorageKey);
          idempotencyStorageKey = null;
        }
        if (errorPayload?.code === "provider_not_submitted" && typeof errorPayload.balance === "number") {
          setCreditBalance(errorPayload.balance);
          cacheCreditBalance(errorPayload.balance);
        }
        if (errorPayload?.code === "video_price_changed" || errorPayload?.code === "generation_price_changed") {
          setPricingTime(errorPayload.pricingTime || Date.now());
        }
        throw new Error(localizeStudioError(errorPayload?.error || st("studio.status.requestFailed"), response.status));
      }

      const payload = (await response.json()) as {
        taskId: string;
        status: "queued" | "running" | "completed" | "failed";
        transport: "real" | "mock";
        statusUrl?: string | null;
        responseUrl?: string | null;
        estimatedCredits?: number;
        balance?: number;
        failureReason?: string | null;
      };

      clearPersistentIdempotency(idempotencyStorageKey);
      idempotencyStorageKey = null;

      if (typeof payload.balance === "number") {
        setCreditBalance(payload.balance);
        cacheCreditBalance(payload.balance);
      }

      const queuedTask: TaskItem = {
        id: payload.taskId,
        type: "Video",
        status:
          payload.status === "running"
            ? "Running"
            : payload.status === "completed"
              ? "Completed"
              : payload.status === "failed"
                ? "Failed"
                : "Queued",
        cost: typeof payload.estimatedCredits === "number" ? payload.estimatedCredits : estimatedCredits,
        title: `${copy.petAppTitle} · ${copy.templates[selectedTemplate.id].title}`,
        provider,
        prompt: selectedTemplate.prompt,
        ratio,
        transport: payload.transport,
        createdAt: new Date().toISOString(),
        statusUrl: payload.statusUrl || null,
        responseUrl: payload.responseUrl || null,
        settings: {
          ...requestPayload,
          imageUrls: uploadedUrls,
          studioApp: PET_APP_ID,
          studioAppTemplate: selectedTemplate.id
        },
        failureReason: payload.failureReason || null
      };

      setTasks((prev) => [queuedTask, ...prev.filter((task) => task.id !== queuedTask.id)]);
      if (!unmountedRef.current) {
        setActiveTaskId(payload.taskId);
        setRightTab("creations");
        setStatusMessage(copy.stageQueued);
      }

      trackEvent(
        "generation_queued",
        {
          mode: "video",
          provider,
          workflow: "image-to-video",
          studio_app: PET_APP_ID,
          template: selectedTemplate.id,
          task_id: payload.taskId,
          transport: payload.transport,
          estimated_credits: estimatedCredits
        },
        liveToken
      );

      submitLockRef.current = false;
      if (!unmountedRef.current) setIsSubmitting(false);

      if (payload.status === "failed") {
        if (!unmountedRef.current) setErrorMessage(payload.failureReason ? localizeStudioError(payload.failureReason) : copy.stageFailed);
        return;
      }

      if (payload.transport === "mock") {
        await new Promise((resolve) => setTimeout(resolve, 900));
        setTasks((prev) => prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task)));
        if (!unmountedRef.current) setStatusMessage(copy.stageRunning);

        await new Promise((resolve) => setTimeout(resolve, 1200));
        const res = await fetch(`/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&mockStatus=completed`, {
          headers: { Authorization: `Bearer ${liveToken}` }
        });
        const statusPayload = (await res.json().catch(() => null)) as { balance?: number | null } | null;
        if (typeof statusPayload?.balance === "number") {
          setCreditBalance(statusPayload.balance);
          cacheCreditBalance(statusPayload.balance);
        }
        setTasks((prev) => prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Completed" } : task)));
        if (!unmountedRef.current) setStatusMessage(copy.stageCompleted);
        return;
      }

      const maxAttempts = frontendPollAttempts("video", provider);
      let finalStatus: "COMPLETED" | "FAILED" | "CANCELED" | "ERROR" | null = null;
      let finalFailureReason: string | null = null;
      let finalActualCredits: number | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        const statusRes = await fetch(
          `/api/generate/status?taskId=${encodeURIComponent(payload.taskId)}&statusUrl=${encodeURIComponent(payload.statusUrl || "")}&responseUrl=${encodeURIComponent(payload.responseUrl || "")}`,
          { headers: { Authorization: `Bearer ${liveToken}` } }
        );
        if (!statusRes.ok) continue;

        const statusPayload = (await statusRes.json()) as {
          status?: string;
          result?: unknown;
          balance?: number | null;
          failureReason?: string;
          actualCredits?: number;
        };
        if (typeof statusPayload.balance === "number") {
          setCreditBalance(statusPayload.balance);
          cacheCreditBalance(statusPayload.balance);
        }

        const rawStatus = (statusPayload.status || "").toUpperCase();
        if (rawStatus === "IN_QUEUE") {
          setTasks((prev) => prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Queued" } : task)));
          if (!unmountedRef.current) setStatusMessage(copy.stageQueued);
        } else if (rawStatus === "IN_PROGRESS") {
          setTasks((prev) => prev.map((task) => (task.id === payload.taskId ? { ...task, status: "Running" } : task)));
          if (!unmountedRef.current) setStatusMessage(copy.stageRunning);
        } else if (["COMPLETED", "FAILED", "CANCELED", "ERROR"].includes(rawStatus)) {
          if (rawStatus === "COMPLETED") {
            const mediaUrl = pickMediaUrl(statusPayload.result);
            setTasks((prev) =>
              prev.map((task) =>
                task.id === payload.taskId
                  ? { ...task, status: "Completed", mediaUrl, mediaUrls: pickImageOutputUrls(statusPayload.result) }
                  : task
              )
            );
          }
          finalStatus = rawStatus as "COMPLETED" | "FAILED" | "CANCELED" | "ERROR";
          finalFailureReason = statusPayload.failureReason || null;
          finalActualCredits = typeof statusPayload.actualCredits === "number" ? statusPayload.actualCredits : null;
          break;
        }
      }

      if (finalStatus === "COMPLETED") {
        if (!unmountedRef.current) setStatusMessage(copy.stageCompleted);
        trackEvent("generation_completed", { mode: "video", provider, studio_app: PET_APP_ID, task_id: payload.taskId, transport: "real" }, liveToken);
      } else if (finalStatus) {
        setTasks((prev) =>
          prev.map((task) =>
            task.id === payload.taskId
              ? { ...task, status: "Failed", cost: finalActualCredits ?? 0, failureReason: finalFailureReason }
              : task
          )
        );
        if (!unmountedRef.current) {
          setErrorMessage(finalFailureReason ? localizeStudioError(finalFailureReason) : copy.stageFailed);
          setStatusMessage("");
        }
      } else if (!unmountedRef.current) {
        setStatusMessage(st("studio.status.backgroundRunning"));
      }
    } catch (error) {
      if (!unmountedRef.current) {
        setErrorMessage(error instanceof Error ? localizeStudioError(error.message) : st("studio.status.submitFailed"));
        setStatusMessage("");
      }
    } finally {
      if (submitLockRef.current) {
        submitLockRef.current = false;
        if (!unmountedRef.current) setIsSubmitting(false);
      }
    }
  }, [
    accessToken,
    cacheCreditBalance,
    cloudMediaEnabled,
    copy.petAppTitle,
    copy.stageCompleted,
    copy.stageFailed,
    copy.stageQueued,
    copy.stageRunning,
    copy.templates,
    copy.uploadRequired,
    creditBalance,
    estimatedCredits,
    localizeStudioError,
    petPhoto,
    provider,
    ratio,
    refreshLiveAccessToken,
    resolvedDuration,
    resolvedResolution,
    selectedTemplate,
    setBillingGenerationContext,
    setBillingModalOpen,
    setCreditBalance,
    setPricingTime,
    setTasks,
    st,
    userId
  ]);

  const templateCopy = copy.templates[selectedTemplate.id];
  const isTaskActive = activeTask && (activeTask.status === "Queued" || activeTask.status === "Running");
  const isTaskCompleted = activeTask?.status === "Completed" && Boolean(activeTask.mediaUrl);
  const activeTaskThumb =
    (Array.isArray(activeTask?.settings?.imageUrls) && typeof activeTask?.settings?.imageUrls[0] === "string"
      ? activeTask.settings.imageUrls[0]
      : null) || petPhoto?.dataUrl || selectedTemplate.coverUrl;

  return (
    <div className="df-apps-shell" data-pet-sing-dance-workbench>
      <div className="df-pet-topbar">
        <div className="df-pet-heading">
          <Link href="/studio?view=apps" className="df-pet-back">
            <StudioIcon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
            <span>{copy.backToApps}</span>
          </Link>
          <h2>{copy.petAppTitle}</h2>
          <span className="df-apps-card-badge df-apps-card-badge--hot">{copy.petAppBadge}</span>
        </div>
        <p className="text-xs text-[var(--df-muted)]">{copy.petAppTagline}</p>
      </div>

      <div className="df-pet-layout">
        {/* Left: Compact Higgsfield-style control rail */}
        <aside ref={railRef} className="df-pet-rail">
          {/* Selected Template Visual Hero Card */}
          <div className="df-pet-selected-card">
            <img src={selectedTemplate.coverUrl} alt={templateCopy.title} />
            <div className="df-pet-selected-scrim">
              <div className="df-pet-selected-top">
                <span className="df-pet-selected-pill">
                  {selectedTemplate.category === "dance" ? copy.filterDance : copy.filterSing}
                </span>
                <div className="df-pet-selected-btns">
                  <button
                    type="button"
                    className="df-pet-chip-btn"
                    onClick={() => setPreviewTemplate(selectedTemplate)}
                    aria-label={`${copy.previewAction} ${templateCopy.title}`}
                  >
                    <ExpandIcon className="h-3.5 w-3.5" />
                    <span>{copy.previewAction}</span>
                  </button>
                  <button
                    type="button"
                    className="df-pet-chip-btn"
                    onClick={handleOpenTemplatePicker}
                  >
                    <span>{copy.changeTemplate}</span>
                  </button>
                </div>
              </div>
              <div className="df-pet-selected-meta">
                <strong>{templateCopy.title}</strong>
                <span>{templateCopy.subtitle}</span>
              </div>
            </div>
          </div>

          {/* Step 1: Pet Photo Upload */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              data-pet-photo-input
              aria-label={copy.uploadTitle}
              onChange={(event) => {
                void readPetFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            {petPhoto ? (
              <div className="df-pet-uploaded">
                <img src={petPhoto.dataUrl} alt={petPhoto.name} />
                <div className="df-pet-uploaded-meta">
                  <strong title={petPhoto.name}>{petPhoto.name}</strong>
                  <div className="df-pet-uploaded-actions">
                    <button type="button" className="df-pet-mini-btn" onClick={() => fileInputRef.current?.click()}>
                      <StudioIcon name="upload" className="h-3.5 w-3.5" />
                      <span>{copy.uploadChange}</span>
                    </button>
                    <button
                      type="button"
                      className="df-pet-mini-btn"
                      onClick={() => {
                        uploadSeqRef.current += 1;
                        setPetPhoto(null);
                      }}
                    >
                      <StudioIcon name="x" className="h-3.5 w-3.5" />
                      <span>{copy.uploadRemove}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                role="button"
                tabIndex={0}
                className="df-pet-dropzone"
                data-dragging={dragging}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void readPetFile(event.dataTransfer.files?.[0]);
                }}
              >
                <span className="df-pet-dropzone-icon" aria-hidden="true">
                  <StudioIcon name="upload" className="h-5 w-5" />
                </span>
                <strong>{copy.uploadTitle}</strong>
                <span>{copy.uploadHint}</span>
              </div>
            )}
          </div>

          {/* Settings: Same Liquid Glass ModelPicker + StudioSelectField popovers as Video Workbench */}
          <div className="df-pet-settings">
            <div className="df-pet-model-picker-wrap">
              <ModelPicker
                inline
                videoAppearance
                value={provider}
                options={petModelPickerOptions}
                translate={st}
                onChange={(next) => handleSelectProvider(next as PetAppProviderId)}
              />
            </div>

            <div className="df-pet-field-grid">
              <StudioSelectField
                icon="duration"
                label={copy.durationLabel}
                value={resolvedDuration}
                options={durationOptions.map((item) => ({ value: item, label: item }))}
                onValueChange={setDuration}
              />

              <StudioSelectField
                icon="resolution"
                label={copy.resolutionLabel}
                value={resolvedResolution}
                options={resolutionOptions.map((item) => ({ value: item, label: item.toUpperCase() }))}
                onValueChange={setResolution}
              />
            </div>

            <details className="df-pet-prompt-details">
              <summary>
                <span>{copy.promptDetailsLabel}</span>
                <StudioIcon name="chevron-down" className="h-3.5 w-3.5" />
              </summary>
              <p className="text-[11px] text-[var(--df-muted)]">{copy.promptDetailsHint}</p>
              <p>{selectedTemplate.prompt}</p>
            </details>
          </div>

          {errorMessage ? (
            <p role="alert" className="df-pet-alert df-pet-alert--error">
              {errorMessage}
            </p>
          ) : null}
          {!errorMessage && statusMessage ? (
            <p role="status" className="df-pet-alert df-pet-alert--ok">
              {statusMessage}
            </p>
          ) : null}

          <button
            type="button"
            className="df-pet-generate-btn"
            data-pet-generate
            disabled={isSubmitting}
            onClick={() => void handleGenerate()}
          >
            <StudioIcon name="sparkles" className="h-4 w-4" />
            <span>{isSubmitting ? copy.generatingButton : copy.generateButton}</span>
            <span className="df-pet-credit-chip">
              {estimatedCredits} {copy.creditsUnit}
            </span>
          </button>
        </aside>

        {/* Right: Higgsfield-grade 9:16 Visual Gallery + My Creations Cinema Stage */}
        <section ref={galleryRef} className="df-pet-gallery-area">
          <div className="df-pet-gallery-bar">
            <div className="df-pet-view-tabs" role="tablist" aria-label={copy.petAppTitle}>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "templates"}
                onClick={() => setRightTab("templates")}
              >
                <StudioIcon name="sparkles" className="h-4 w-4" />
                <span>{copy.tabTemplates}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={rightTab === "creations"}
                onClick={() => setRightTab("creations")}
              >
                <StudioIcon name="video" className="h-4 w-4" />
                <span>{copy.tabCreations}</span>
                {runningPetCount > 0 ? (
                  <span className="df-pet-tab-badge df-pet-tab-badge--live">{runningPetCount}</span>
                ) : recentPetTasks.length > 0 ? (
                  <span className="df-pet-tab-badge">{recentPetTasks.length}</span>
                ) : null}
              </button>
            </div>

            {rightTab === "templates" ? (
              <div className="df-pet-filter-tabs" role="group" aria-label={copy.stepTemplate}>
                {(["all", "dance", "sing"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    aria-pressed={category === tab}
                    onClick={() => setCategory(tab)}
                  >
                    {tab === "all" ? copy.filterAll : tab === "dance" ? copy.filterDance : copy.filterSing}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {rightTab === "templates" ? (
            <div className="df-pet-poster-grid">
              {visibleTemplates.map((tpl) => {
                const info = copy.templates[tpl.id];
                const selected = tpl.id === selectedTemplate.id;
                return (
                  <div key={tpl.id} className="df-pet-poster-card" data-selected={selected || undefined}>
                    <button
                      type="button"
                      className="df-pet-poster-select"
                      data-pet-template={tpl.id}
                      aria-pressed={selected}
                      onClick={() => handleSelectTemplate(tpl, true)}
                    >
                      <img src={tpl.coverUrl} alt={info.title} loading="lazy" />
                      <div className="df-pet-poster-overlay">
                        <div className="df-pet-poster-top">
                          {tpl.badge ? (
                            <span className="df-pet-poster-badge">{copy.badges[tpl.badge]}</span>
                          ) : (
                            <span className="df-pet-poster-badge">
                              {tpl.category === "dance" ? copy.filterDance : copy.filterSing}
                            </span>
                          )}
                        </div>
                        <div className="df-pet-poster-footer">
                          {selected ? (
                            <span className="df-pet-poster-selected-tag">
                              <StudioIcon name="check" className="h-3 w-3" />
                              <span>{copy.selectedLabel}</span>
                            </span>
                          ) : null}
                          <strong>{info.title}</strong>
                          <span>{info.subtitle}</span>
                        </div>
                      </div>
                    </button>
                    <button
                      type="button"
                      className="df-pet-poster-preview-btn"
                      aria-label={`${copy.previewAction} ${info.title}`}
                      title={copy.previewAction}
                      onClick={() => setPreviewTemplate(tpl)}
                    >
                      <ExpandIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="df-pet-creations-view">
              {activeTask || isSubmitting ? (
                <div className="df-pet-creations-stage">
                  <div className="df-pet-stage-frame">
                    {isTaskCompleted && activeTask?.mediaUrl ? (
                      <video
                        key={activeTask.mediaUrl}
                        src={activeTask.mediaUrl}
                        controls
                        autoPlay
                        loop
                        playsInline
                        className="df-pet-stage-video"
                      />
                    ) : (
                      <>
                        <img src={activeTaskThumb} alt={templateCopy.title} className="df-pet-stage-image" />
                        {isTaskActive || isSubmitting ? (
                          <div className="df-pet-stage-loading" role="status" aria-live="polite">
                            <div className="df-pet-spinner" aria-hidden="true" />
                            <strong className="text-sm font-semibold">
                              {activeTask?.status === "Running" ? copy.stageRunning : copy.stageQueued}
                            </strong>
                            <span className="text-xs text-[var(--df-stage-muted)]">
                              {templateCopy.title} · {resolvedDuration} · {resolvedResolution.toUpperCase()}
                            </span>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  {isTaskCompleted && activeTask?.mediaUrl ? (
                    <div className="df-pet-stage-actions">
                      <a
                        href={activeTask.mediaUrl}
                        download={`dreamface-pet-${selectedTemplate.id}.mp4`}
                        target="_blank"
                        rel="noreferrer"
                        className="df-pet-stage-action df-pet-stage-action--primary"
                      >
                        {copy.downloadVideo}
                      </a>
                      <Link href={studioProjectHref(activeTask.id)} className="df-pet-stage-action">
                        {copy.openInProjects}
                      </Link>
                      <button
                        type="button"
                        className="df-pet-stage-action"
                        onClick={() => setRightTab("templates")}
                      >
                        {copy.tryAnother}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="df-pet-creations-empty">
                  <div className="df-pet-creations-empty-thumbs" aria-hidden="true">
                    {PET_SING_DANCE_TEMPLATES.slice(0, 3).map((tpl) => (
                      <img key={tpl.id} src={tpl.coverUrl} alt="" />
                    ))}
                  </div>
                  <h3>{copy.emptyCreationsTitle}</h3>
                  <p>{copy.emptyCreationsHint}</p>
                  <button
                    type="button"
                    className="df-pet-stage-action df-pet-stage-action--primary"
                    onClick={() => setRightTab("templates")}
                  >
                    {copy.tabTemplates}
                  </button>
                </div>
              )}

              {recentPetTasks.length > 0 ? (
                <div className="df-pet-recent">
                  <h3>{copy.recentTitle}</h3>
                  <div className="df-pet-recent-strip">
                    {recentPetTasks.map((task) => {
                      const thumbUrl =
                        Array.isArray(task.settings?.imageUrls) && typeof task.settings.imageUrls[0] === "string"
                          ? task.settings.imageUrls[0]
                          : null;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className="df-pet-recent-item"
                          aria-pressed={activeTask?.id === task.id}
                          onClick={() => setActiveTaskId(task.id)}
                        >
                          {task.mediaUrl ? (
                            <video src={task.mediaUrl} muted playsInline preload="metadata" />
                          ) : thumbUrl ? (
                            <img src={thumbUrl} alt={task.title || copy.petAppTitle} />
                          ) : null}
                          <span className="df-pet-recent-status">{task.status}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </section>
      </div>

      {/* Full-bleed 9:16 Reels-style Template Preview Modal (portal over entire Studio + mobile dock) */}
      {previewTemplate && typeof document !== "undefined"
        ? createPortal(
            <div
              className="studio-overlay df-pet-lightbox-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={copy.templates[previewTemplate.id].title}
              onClick={() => setPreviewTemplate(null)}
            >
              <div
                className="df-pet-lightbox"
                onClick={(event) => event.stopPropagation()}
                onTouchStart={(event) => {
                  touchStartXRef.current = event.touches[0]?.clientX ?? null;
                }}
                onTouchEnd={(event) => {
                  const startX = touchStartXRef.current;
                  touchStartXRef.current = null;
                  if (startX === null) return;
                  const endX = event.changedTouches[0]?.clientX ?? startX;
                  const delta = endX - startX;
                  if (Math.abs(delta) > 48) stepPreview(delta > 0 ? -1 : 1);
                }}
              >
                <img
                  key={previewTemplate.id}
                  src={previewTemplate.coverUrl}
                  alt={copy.templates[previewTemplate.id].title}
                  className="df-pet-lightbox-img"
                />

                <div className="df-pet-lightbox-top">
                  <span className="df-pet-lightbox-pill">
                    {previewTemplate.category === "dance" ? copy.filterDance : copy.filterSing}
                    {previewIndex >= 0 ? ` · ${previewIndex + 1} / ${previewList.length}` : ""}
                  </span>
                  <button
                    type="button"
                    className="df-pet-lightbox-close"
                    aria-label={copy.closePreview}
                    onClick={() => setPreviewTemplate(null)}
                  >
                    <StudioIcon name="x" className="h-4 w-4" />
                  </button>
                </div>

                {previewList.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="df-pet-lightbox-nav df-pet-lightbox-nav--prev"
                      aria-label="Previous"
                      onClick={() => stepPreview(-1)}
                    >
                      <StudioIcon name="chevron-left" className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      className="df-pet-lightbox-nav df-pet-lightbox-nav--next"
                      aria-label="Next"
                      onClick={() => stepPreview(1)}
                    >
                      <StudioIcon name="chevron-right" className="h-5 w-5" />
                    </button>
                  </>
                ) : null}

                <div className="df-pet-lightbox-bottom">
                  <div className="df-pet-lightbox-title-row">
                    <div>
                      <h3>{copy.templates[previewTemplate.id].title}</h3>
                      <p>{copy.templates[previewTemplate.id].subtitle}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="df-pet-generate-btn"
                    onClick={() => {
                      handleSelectTemplate(previewTemplate);
                      setPreviewTemplate(null);
                      if (typeof window !== "undefined" && window.innerWidth <= 1024) {
                        requestAnimationFrame(() => {
                          railRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }
                    }}
                  >
                    <StudioIcon name="check" className="h-4 w-4" />
                    <span>
                      {previewTemplate.id === selectedTemplate.id ? copy.selectedLabel : copy.useStyleAction}
                    </span>
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

export function StudioAppsWorkspace({ model }: { model: StudioController }) {
  if (model.activeApp === PET_APP_ID) {
    return <PetSingDanceWorkbench model={model} />;
  }
  return <StudioAppsHub model={model} />;
}
