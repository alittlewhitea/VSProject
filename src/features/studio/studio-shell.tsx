"use client";
import dynamic from "next/dynamic";
import { AuthLink } from "../../components/auth-link";
import { isRtlLocale } from "../../i18n/routing";
import { trackEvent } from "../../lib/analytics";
const StudioBillingModal = dynamic(() => import("./studio-billing-modal").then(module=>module.StudioBillingModal));
const StudioBillingWorkspace = dynamic(() => import("./studio-billing-workspace").then(module=>module.StudioBillingWorkspace));
import { StudioHeader } from "./studio-header";
const StudioHome = dynamic(() => import("./studio-home").then(module=>module.StudioHome));
import {
StudioBottomNavigation,
StudioSidebar
} from "./studio-navigation";
const StudioProjects = dynamic(() => import("./studio-projects").then(module=>module.StudioProjects));
const StudioReferrals = dynamic(() => import("./studio-referrals").then(module=>module.StudioReferrals));
import { StudioScrollToBottom } from "./studio-scroll-to-bottom";
import "./studio-theme.css";
import { STUDIO_SIGN_IN_URL,providerLabel } from "./studio-workspace-config";

import type { StudioController } from "./use-studio-controller";
const StudioCreationWorkspace = dynamic(() => import("./studio-creation-workspace"), {loading:()=> <div className="min-h-72 animate-pulse rounded-2xl bg-[var(--studio-panel)]" aria-busy="true" />});
export function StudioShell({model}:{model:StudioController}) {
  const {
    accessToken,
    applyWorkflow,
    audioWorkflow,
    authReady,
    billingGenerationContext,
    billingHref,
    billingMessage,
    billingModalOpen,
    billingModalScrollRef,
    creditBalance,
    creditNote,
    duration,
    isAppsHome,
    isBillingView,
    isProjectsView,
    isReferralsView,
    loadingBillingItem,
    mobileStudioMenuOpen,
    mode,
    openBillingModal,
    previewModal,
    referralsVisible,
    saveLoginDraft,
    selectedProjectTask,
    setBillingGenerationContext,
    setBillingModalOpen,
    setCreditBalance,
    setMobileStudioMenuOpen,
    setPreviewModal,
    setVideoSidebarCollapsed,
    showModernStudioChrome,
    sp,
    st,
    startHomeCreation,
    startStudioCreditCheckout,
    studioI18n,
    taskHistoryNote,
    tasks,
    useWideStudioShell,
    videoSidebarCollapsed,
  } = model;
  return (
    <main
      dir={isRtlLocale(studioI18n.locale) ? "rtl" : "ltr"}
      className="creative-studio relative min-h-screen w-full max-w-full overflow-x-clip"
    >
      <div className={showModernStudioChrome ? "w-full" : useWideStudioShell ? "mx-auto my-3 w-[calc(100vw-24px)] max-w-[1760px] md:my-7 md:w-[calc(100vw-56px)]" : "mx-auto w-full max-w-[1540px] px-2 pt-2 md:px-8 md:pt-5"}>
        {!authReady && !showModernStudioChrome ? (
          <section className="mb-4 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] p-6 text-sm text-[var(--studio-muted)] shadow-sm">
            {st("studio.checkingSession")}
          </section>
        ) : null}

        {billingModalOpen ? <StudioBillingModal
          accessToken={accessToken}
          open={billingModalOpen}
          t={st}
          loadingItem={loadingBillingItem}
          message={billingMessage}
          creditBalance={creditBalance}
          generationContext={billingGenerationContext}
          scrollRef={billingModalScrollRef}
          onClose={() => {
            setBillingModalOpen(false);
            setBillingGenerationContext(null);
          }}
          onCreditCheckout={startStudioCreditCheckout}
        /> : null}

        <section className={showModernStudioChrome ? "relative min-h-screen w-full max-w-full bg-transparent" : "relative min-h-[calc(100vh-1rem)] w-full max-w-full overflow-hidden rounded-[1.35rem] border border-[var(--studio-border)] bg-[var(--studio-panel)] shadow-none backdrop-blur-2xl md:rounded-[2.25rem] md:shadow-none"}>
          <div className={`grid min-h-screen min-w-0 transition-[grid-template-columns] duration-300 ease-out ${showModernStudioChrome ? videoSidebarCollapsed ? "md:grid-cols-[76px_minmax(0,1fr)]" : "md:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[216px_minmax(0,1fr)]" : "lg:min-h-[calc(100vh-2rem)] lg:grid-cols-[96px_minmax(0,1fr)]"}`}>
            <StudioSidebar
              referralsVisible={referralsVisible}
              referralLocale={studioI18n.locale}
              isBillingView={isBillingView}
              billingHref={billingHref}
              isReferralsView={isReferralsView && referralsVisible}
              t={st}
              modern={showModernStudioChrome}
              videoStudio={showModernStudioChrome}
              collapsed={videoSidebarCollapsed}
              creditBalance={creditBalance}
              signedIn={Boolean(accessToken)}
              onCollapsedChange={setVideoSidebarCollapsed}
              mode={mode}
              isAppsHome={isAppsHome}
              isProjectsView={isProjectsView}
              onImageWorkflowSelected={(workflowLabel) =>
                trackEvent("studio_workflow_selected", { mode: "image", workflow: workflowLabel, surface: "sidebar_hover" }, accessToken)
              }
            />

            <StudioBottomNavigation isBillingView={isBillingView} billingHref={billingHref} t={st} mode={mode} isAppsHome={isAppsHome} isProjectsView={isProjectsView} isReferralsView={isReferralsView && referralsVisible} />
            <div className={`studio-content relative min-w-0 max-w-full ${showModernStudioChrome ? "px-3.5 pb-[calc(90px+env(safe-area-inset-bottom))] lg:px-7 lg:pb-8" : "px-3 pb-24 pt-3 md:px-8 md:py-5 lg:px-12"}`}>
              <StudioHeader
                referralsVisible={referralsVisible}
                isBillingView={isBillingView}
              billingHref={billingHref}
              isReferralsView={isReferralsView && referralsVisible}
                t={st}
                modern={showModernStudioChrome}
                videoStudio={showModernStudioChrome}
                mode={mode}
                isAppsHome={isAppsHome}
                isProjectsView={isProjectsView}
                mobileMenuOpen={mobileStudioMenuOpen}
                signedIn={Boolean(accessToken)}
                signInUrl={STUDIO_SIGN_IN_URL}
                locale={studioI18n.locale}
                locales={studioI18n.locales}
                localeLabels={studioI18n.localeLabels}
                creditBalance={creditBalance}
                audioWorkflow={audioWorkflow}
                onMobileMenuOpenChange={setMobileStudioMenuOpen}
                onLocaleChange={studioI18n.setLocale}
                onBillingOpen={openBillingModal}
                onAudioWorkflowSelect={applyWorkflow}
              />
              {creditNote && !showModernStudioChrome ? (
                <p className="mt-3 rounded-2xl border border-[var(--studio-border)] bg-[var(--studio-panel)] px-4 py-3 text-xs font-semibold text-[var(--studio-muted)] shadow-sm">
                  {!accessToken && creditNote === st("studio.status.signInCredit") ? (
                    <>
                      <AuthLink href={STUDIO_SIGN_IN_URL} authOptions={{ onBeforeRedirect: () => saveLoginDraft(false) }} className="font-semibold text-[var(--studio-accent)] underline-offset-4 hover:underline">
                        {st("studio.auth.signIn")}
                      </AuthLink>
                      {creditNote.replace(st("studio.auth.signIn"), "")}
                    </>
                  ) : (
                    creditNote
                  )}
                </p>
              ) : null}

              {isBillingView ? <StudioBillingWorkspace locale={studioI18n.locale} onBalanceChange={setCreditBalance} /> : null}

              {isAppsHome ? (
                <StudioHome t={st} locale={studioI18n.locale} onCreate={startHomeCreation} />
              ) : null}

              {isReferralsView && referralsVisible ? <StudioReferrals accessToken={accessToken} locale={studioI18n.locale} /> : null}
              {isReferralsView && !referralsVisible ? <StudioHome t={st} locale={studioI18n.locale} onCreate={startHomeCreation} /> : null}
              {isProjectsView && !isReferralsView ? (
                <StudioProjects
                  locale={studioI18n.locale}
                  t={st}
                  tasks={tasks}
                  selectedTask={selectedProjectTask}
                  historyNote={taskHistoryNote}
                  duration={duration}
                  providerLabel={providerLabel}
                  onPreviewImage={(url) => setPreviewModal({ url, type: "Image" })}
                />
              ) : null}

              {!isAppsHome && !isProjectsView && !isBillingView ? <StudioCreationWorkspace model={model} /> : null}
            </div>
          </div>
        </section>

        {previewModal ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={() => setPreviewModal(null)}>
            <div className="max-h-[92vh] w-full max-w-5xl" onClick={(e) => e.stopPropagation()}>
              <div className="mb-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setPreviewModal(null)}
                  className="rounded-full border border-[var(--studio-border)] bg-black/40 px-3 py-1 text-sm font-semibold text-white"
                >
                  {st("studio.modal.close")}
                </button>
              </div>
              {previewModal.type === "Video" ? (
                <video src={previewModal.url} controls autoPlay className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              ) : (
                <img src={previewModal.url} alt="Preview" className="max-h-[85vh] w-full rounded-xl bg-black object-contain" />
              )}
            </div>
          </div>
        ) : null}
      </div>
      <StudioScrollToBottom translate={st} routeKey={sp.toString()} />
    </main>
  );
}
