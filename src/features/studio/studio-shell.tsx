"use client";

import { useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { AuthLink } from "../../components/auth-link";
import { isRtlLocale } from "../../i18n/routing";
import { StudioHeader } from "./studio-header";
import { StudioBottomNavigation, StudioSidebar } from "./studio-navigation";
import { StudioScrollToBottom } from "./studio-scroll-to-bottom";
import { StudioTaskToast } from "./studio-task-toast";
import "./studio-theme.css";
import { STUDIO_SIGN_IN_URL, providerLabel } from "./studio-workspace-config";
import type { StudioController } from "./use-studio-controller";

const StudioBillingModal = dynamic(() => import("./studio-billing-modal").then((module) => module.StudioBillingModal));
const StudioBillingWorkspace = dynamic(() => import("./studio-billing-workspace").then((module) => module.StudioBillingWorkspace));
const StudioAppsWorkspace = dynamic(() => import("./studio-apps-workspace").then((module) => module.StudioAppsWorkspace), {
  loading: () => <div className="min-h-72 animate-pulse rounded-2xl bg-[var(--studio-panel)]" aria-busy="true" />
});
const StudioHome = dynamic(() => import("./studio-home").then((module) => module.StudioHome));
const StudioProjects = dynamic(() => import("./studio-projects").then((module) => module.StudioProjects));
const StudioReferrals = dynamic(() => import("./studio-referrals").then((module) => module.StudioReferrals));
const StudioCreationWorkspace = dynamic(() => import("./studio-creation-workspace"), {
  loading: () => <div className="min-h-72 animate-pulse rounded-2xl bg-[var(--studio-panel)]" aria-busy="true" />
});
const StudioAssistant = dynamic(() => import("./studio-assistant-preview").then((module) => module.StudioAssistantPreview), { ssr: false });

export function StudioShell({ model }: { model: StudioController }) {
  const {
    accessToken,
    activeApp,
    activeTasks,
    billingGenerationContext,
    billingHref,
    billingMessage,
    billingModalOpen,
    billingModalScrollRef,
    creditBalance,
    duration,
    isAppsHome,
    isAppsView,
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
    showVideoWorkbenchRedesign,
    sp,
    st,
    startHomeCreation,
    startStudioCreditCheckout,
    studioI18n,
    taskHistoryNote,
    tasks,
    videoSidebarCollapsed
  } = model;

  const isCreationView = !isAppsHome && !isAppsView && !isProjectsView && !isBillingView;
  const showMobileNavigation = isAppsHome || isAppsView || isCreationView;
  const routeKey = sp.toString();
  const expandedSidebarColumns = isCreationView ? "xl:grid-cols-[240px_minmax(0,1fr)]" : "xl:grid-cols-[216px_minmax(0,1fr)]";
  const gridColumns = `md:grid-cols-[76px_minmax(0,1fr)] ${videoSidebarCollapsed ? "" : expandedSidebarColumns}`;

  const handleOpenBalanceBilling = useCallback(() => openBillingModal("balance"), [openBillingModal]);
  const handleCloseBillingModal = useCallback(() => {
    setBillingModalOpen(false);
    setBillingGenerationContext(null);
  }, [setBillingGenerationContext, setBillingModalOpen]);
  const handlePreviewImage = useCallback((url: string) => setPreviewModal({ url, type: "Image" }), [setPreviewModal]);
  const headerSignInLink = useMemo(
    () => (
      <AuthLink href={STUDIO_SIGN_IN_URL} authOptions={{ onBeforeRedirect: () => saveLoginDraft(false) }} className="df-button df-button--secondary df-sign-in">
        <span>{st("studio.auth.signIn")}</span>
      </AuthLink>
    ),
    [saveLoginDraft, st]
  );

  return (
    <main
      dir={isRtlLocale(studioI18n.locale) ? "rtl" : "ltr"}
      data-mobile-studio-navigation={showMobileNavigation || undefined}
      className={`creative-studio relative min-h-screen w-full max-w-full overflow-x-clip${showVideoWorkbenchRedesign ? " df-video-studio" : ""}`}
    >
      <div className="w-full">
        {billingModalOpen ? <StudioBillingModal
          accessToken={accessToken}
          open={billingModalOpen}
          t={st}
          loadingItem={loadingBillingItem}
          message={billingMessage}
          creditBalance={creditBalance}
          generationContext={billingGenerationContext}
          scrollRef={billingModalScrollRef}
          onClose={handleCloseBillingModal}
          onCreditCheckout={startStudioCreditCheckout}
        /> : null}

        <section className="relative min-h-screen w-full max-w-full bg-transparent">
          <div className={`grid min-h-screen min-w-0 transition-[grid-template-columns] duration-300 ease-out ${gridColumns}`}>
            <StudioSidebar
              referralsVisible={referralsVisible}
              referralLocale={studioI18n.locale}
              isAppsView={isAppsView}
              isBillingView={isBillingView}
              billingHref={billingHref}
              isReferralsView={isReferralsView && referralsVisible}
              t={st}
              collapsed={videoSidebarCollapsed}
              creditBalance={creditBalance}
              activeTaskCount={activeTasks.length}
              signedIn={Boolean(accessToken)}
              onOpenCredits={handleOpenBalanceBilling}
              onCollapsedChange={setVideoSidebarCollapsed}
              mode={mode}
              isAppsHome={isAppsHome}
              isProjectsView={isProjectsView}
            />

            <div className={`studio-content relative min-w-0 max-w-full ${isCreationView ? "df-workbench-content" : ""} px-3.5 pb-[calc(90px+env(safe-area-inset-bottom))] lg:px-7 lg:pb-8`}>
              <StudioHeader
                referralsVisible={referralsVisible}
                isAppsView={isAppsView}
                activeApp={activeApp}
                isBillingView={isBillingView}
                billingHref={billingHref}
                isReferralsView={isReferralsView && referralsVisible}
                t={st}
                mode={mode}
                isAppsHome={isAppsHome}
                isProjectsView={isProjectsView}
                mobileMenuOpen={mobileStudioMenuOpen}
                signedIn={Boolean(accessToken)}
                signInUrl={STUDIO_SIGN_IN_URL}
                signInLink={headerSignInLink}
                locale={studioI18n.locale}
                locales={studioI18n.locales}
                localeLabels={studioI18n.localeLabels}
                creditBalance={creditBalance}
                activeTaskCount={activeTasks.length}
                onMobileMenuOpenChange={setMobileStudioMenuOpen}
                onLocaleChange={studioI18n.setLocale}
                onBillingOpen={openBillingModal}
              />

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
                  onPreviewImage={handlePreviewImage}
                />
              ) : null}

              {isAppsView ? (
                <StudioAppsWorkspace model={model} />
              ) : !isAppsHome && !isProjectsView && !isBillingView ? (
                <div className="df-workbench-canvas">
                  <StudioCreationWorkspace model={model} />
                </div>
              ) : null}
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
      {showMobileNavigation ? <StudioBottomNavigation t={st} locale={studioI18n.locale} mode={mode} isAppsHome={isAppsHome} isAppsView={isAppsView} isProjectsView={isProjectsView} currentHref={routeKey ? `/studio?${routeKey}` : "/studio"} /> : null}
      <StudioScrollToBottom translate={st} routeKey={routeKey} />
      <StudioTaskToast
        tasks={tasks}
        activeCount={activeTasks.length}
        hidden={isProjectsView || isBillingView || isReferralsView || billingModalOpen || Boolean(previewModal) || mobileStudioMenuOpen}
        t={st}
        providerLabel={providerLabel}
      />
      {!isProjectsView && !isBillingView && !isReferralsView && !billingModalOpen && !previewModal && !mobileStudioMenuOpen ? <StudioAssistant model={model} /> : null}
    </main>
  );
}
