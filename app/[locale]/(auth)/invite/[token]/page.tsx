import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";
import { peekInvitation } from "@/lib/auth/invites";
import { normalizeEmail } from "@/lib/auth/invite-token";
import { AuthSplit } from "@/components/auth/AuthSplit";
import { btnNavy, btnGhost } from "@/components/ui/display";
import { AcceptInvite } from "./AcceptInvite";

/** Never cache an invitation: its state changes the moment someone accepts or
 * revokes it, and a cached "still valid" page is a link that lies. */
export const dynamic = "force-dynamic";

function Card({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--heading)", lineHeight: 1.6 }}>{title}</h1>
      <p style={{ fontSize: 14.5, color: "var(--slate)", lineHeight: 1.9, marginBlock: "10px 20px" }}>{body}</p>
      {children}
    </div>
  );
}

export default async function InvitePage({ params }: { params: Promise<{ locale: string; token: string }> }) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Invite");

  const inv = await peekInvitation(token);

  const panel = (
    <>
      <h2 style={{ fontSize: "clamp(24px,3vw,32px)", fontWeight: 700, lineHeight: 1.6 }}>{t("panelTitle")}</h2>
      <p style={{ color: "rgba(255,255,255,.70)", lineHeight: 1.9, fontSize: 14.5, marginBlockStart: 14 }}>{t("panelBody")}</p>
    </>
  );

  if (!inv.ok) {
    return (
      <AuthSplit panel={panel}>
        <Card title={t(`dead_${inv.reason}_title`)} body={t(`dead_${inv.reason}_body`)}>
          <Link href="/login" style={btnGhost}>{t("toLogin")}</Link>
        </Card>
      </AuthSplit>
    );
  }

  const supabase = await getSupabaseServer();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = data.user;

  // Not signed in: send them to sign in or sign up, and bring them straight
  // back here afterwards rather than dropping them on a dashboard with no idea
  // what became of the invitation they clicked.
  if (!user) {
    const back = `/${locale === "en" ? "en" : "ar"}/invite/${encodeURIComponent(token)}`;
    return (
      <AuthSplit panel={panel}>
        <Card title={t("signedOutTitle", { org: inv.orgName })} body={t("signedOutBody", { email: inv.email })}>
          <div style={{ display: "grid", gap: 10 }}>
            <Link href={{ pathname: "/login", query: { next: back } }} style={btnNavy}>{t("signIn")}</Link>
            <Link href="/signup" style={btnGhost}>{t("createAccount")}</Link>
          </div>
        </Card>
      </AuthSplit>
    );
  }

  // Signed in as someone else. Saying so beats a generic refusal after the
  // click: the fix is to switch accounts, and nothing else will work.
  if (normalizeEmail(user.email ?? "") !== normalizeEmail(inv.email)) {
    return (
      <AuthSplit panel={panel}>
        <Card title={t("wrongAccountTitle")} body={t("wrongAccountBody", { invited: inv.email, current: user.email ?? "" })}>
          <Link href="/login" style={btnGhost}>{t("switchAccount")}</Link>
        </Card>
      </AuthSplit>
    );
  }

  return (
    <AuthSplit panel={panel}>
      <Card title={t("title", { org: inv.orgName })} body={t("body", { role: t(`role_${inv.role}`) })}>
        <AcceptInvite token={token} />
      </Card>
    </AuthSplit>
  );
}
