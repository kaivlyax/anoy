import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { premiumApi, paymentApi } from "../services/api";
import ProBadge from "../components/ProBadge";
import AvatarFrame from "../components/AvatarFrame";
import {
  SparklesIcon,
  ShieldIcon,
  CheckIcon,
  LockIcon,
  LoaderIcon,
  XIcon
} from "../components/Icons";

/**
 * Safely and dynamically loads the Razorpay Standard Checkout script.
 * Prevents multiple script inclusions.
 */
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      return resolve(true);
    }
    const existingScript = document.querySelector(
      'script[src="https://checkout.razorpay.com/v1/checkout.js"]'
    );
    if (existingScript) {
      existingScript.onload = () => resolve(true);
      existingScript.onerror = () => resolve(false);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function Store() {
  const { user, profile, refreshProfile } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("plans"); // 'plans' | 'frames' | 'themes' | 'decorations' | 'emojis' | 'inventory'
  const [catalog, setCatalog] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Payment State
  const [processingPlan, setProcessingPlan] = useState(null); // planCode being purchased
  const [verifyingPayment, setVerifyingPayment] = useState(false);

  // Cosmetic Unlock Modal State
  const [selectedItem, setSelectedItem] = useState(null);
  const [purchasingCosmetic, setPurchasingCosmetic] = useState(false);
  const [activatingId, setActivatingId] = useState(null);

  const fetchStoreData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const [catRes, invRes, payRes] = await Promise.all([
        premiumApi.getCatalog(),
        premiumApi.getInventory(),
        paymentApi.getPaymentHistory().catch(() => ({ data: { success: false, payments: [] } }))
      ]);

      if (catRes.data.success) {
        setCatalog(catRes.data.catalog);
      }
      if (invRes.data.success) {
        setInventory(invRes.data.inventory);
      }
      if (payRes.data?.success) {
        setPaymentHistory(payRes.data.payments || []);
      }
    } catch (err) {
      console.error("Fetch store data error:", err);
      setError("Failed to load store catalog.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoreData();
  }, [fetchStoreData]);

  const isProUser = Boolean(
    profile?.isPro && (!profile?.proExpiresAt || new Date(profile?.proExpiresAt) > new Date())
  );

  /**
   * Razorpay Standard Web Checkout Handler for ANOY Pro Plans (Currently in Coming Soon mode)
   */
  const handleRazorpaySubscribe = async (plan) => {
    addToast("ANOY Pro subscriptions are coming soon! Stay tuned.", "info");
    /* Future activation handler:
    if (!plan || processingPlan || verifyingPayment) return;
    try {
      setProcessingPlan(plan.planCode);
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded || !window.Razorpay) {
        addToast("Failed to load Razorpay SDK. Please check your internet connection.", "error");
        setProcessingPlan(null);
        return;
      }
      const orderRes = await paymentApi.createOrder(plan.planCode);
      if (!orderRes.data?.success) throw new Error(orderRes.data?.message || "Failed to create payment order");
      const { order_id, amount, currency, key_id } = orderRes.data;
      const razorpayKey = key_id || import.meta.env.VITE_RAZORPAY_KEY_ID;
      // ...
    } catch (err) { ... }
    */
  };

  /**
   * Handle Cosmetic Item Unlock (free development unlocked items)
   */
  const handleConfirmCosmeticUnlock = async () => {
    if (!selectedItem) return;
    try {
      setPurchasingCosmetic(true);
      const res = await premiumApi.checkoutMock(selectedItem.id);
      if (res.data.success) {
        addToast(res.data.message || `Unlocked ${selectedItem.name}!`, "success");
        setSelectedItem(null);
        await refreshProfile();
        await fetchStoreData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Unlock failed", "error");
    } finally {
      setPurchasingCosmetic(false);
    }
  };

  // Handle Equip Customization
  const handleEquip = async (type, itemId) => {
    try {
      setActivatingId(itemId);
      const res = await premiumApi.activateCustomization(type, itemId);
      if (res.data.success) {
        addToast(`Equipped ${itemId ? "customization" : "default"}!`, "success");
        await refreshProfile();
        await fetchStoreData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to equip item", "error");
    } finally {
      setActivatingId(null);
    }
  };

  // Handle Unequip Customization
  const handleUnequip = async (type) => {
    try {
      setActivatingId(type);
      const res = await premiumApi.deactivateCustomization(type);
      if (res.data.success) {
        addToast("Customization unequipped", "info");
        await refreshProfile();
        await fetchStoreData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to unequip", "error");
    } finally {
      setActivatingId(null);
    }
  };

  return (
    <div className="store-page-container">
      {/* Store Header & Pro Hero */}
      <div className="store-hero">
        <div className="store-hero-content">
          <div className="store-hero-badge-row">
            <ProBadge size="lg" />
            <span className="store-hero-tag">PREMIUM STORE & MEMBERSHIP</span>
          </div>
          <h1 className="store-hero-title">Elevate Your Presence on ANOY</h1>
          <p className="store-hero-subtitle">
            Unlock animated avatar frames, custom profile themes, community boosting, and exclusive emoji packs with ANOY Pro.
          </p>

          {isProUser ? (
            <div className="store-status-card pro-active">
              <div className="store-status-icon">✨</div>
              <div>
                <div className="store-status-title">You are an ANOY Pro Member!</div>
                <div className="store-status-desc">
                  Plan: <strong>{profile?.proPlan || "PRO_MONTHLY"}</strong>
                  {profile?.proExpiresAt && ` • Renews / Expires on ${new Date(profile.proExpiresAt).toLocaleDateString()}`}
                  {!profile?.proExpiresAt && " • Permanent Lifetime VIP"}
                </div>
              </div>
            </div>
          ) : (
            <div className="store-status-card free-tier">
              <div>
                <div className="store-status-title">Free Membership</div>
                <div className="store-status-desc">Upgrade to ANOY Pro to unlock exclusive styling, 25MB uploads, and boost communities.</div>
              </div>
              <button
                type="button"
                className="store-upgrade-cta-btn"
                onClick={() => setActiveTab("plans")}
              >
                <SparklesIcon size={16} />
                <span>Upgrade to Pro</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="store-tabs">
        <button
          type="button"
          className={`store-tab ${activeTab === "plans" ? "active" : ""}`}
          onClick={() => setActiveTab("plans")}
        >
          Pro Plans
        </button>
        <button
          type="button"
          className={`store-tab ${activeTab === "frames" ? "active" : ""}`}
          onClick={() => setActiveTab("frames")}
        >
          Avatar Frames
        </button>
        <button
          type="button"
          className={`store-tab ${activeTab === "themes" ? "active" : ""}`}
          onClick={() => setActiveTab("themes")}
        >
          Profile Themes
        </button>
        <button
          type="button"
          className={`store-tab ${activeTab === "decorations" ? "active" : ""}`}
          onClick={() => setActiveTab("decorations")}
        >
          Decorations
        </button>
        <button
          type="button"
          className={`store-tab ${activeTab === "emojis" ? "active" : ""}`}
          onClick={() => setActiveTab("emojis")}
        >
          Emoji Packs
        </button>
        <button
          type="button"
          className={`store-tab ${activeTab === "inventory" ? "active" : ""}`}
          onClick={() => setActiveTab("inventory")}
        >
          My Inventory & Orders
        </button>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="store-loading-state">
          <LoaderIcon size={32} />
          <p>Loading premium catalog...</p>
        </div>
      )}

      {error && (
        <div className="auth-error-banner" style={{ margin: "20px auto", maxWidth: 600 }}>
          {error}
        </div>
      )}

      {!loading && catalog && (
        <div className="store-content-grid">
          {/* TAB 1: PRO PLANS (COMING SOON) */}
          {activeTab === "plans" && (
            <div>
              <div style={{
                background: "rgba(168, 85, 247, 0.08)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                borderRadius: "12px",
                padding: "16px 20px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#e2e8f0"
              }}>
                <SparklesIcon size={24} style={{ color: "#c084fc", flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "15px", color: "#f3e8ff" }}>
                    ANOY Pro Subscriptions — Coming Soon
                  </div>
                  <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "2px" }}>
                    Paid memberships with Razorpay checkout are currently being finalized. Free accounts have full access to social features, feed, communities, and themes!
                  </div>
                </div>
              </div>

              <div className="plans-grid">
                {catalog.plans.map((plan) => {
                  const displayPrice = plan.priceINR ? `₹${plan.priceINR}` : `₹99`;
                  const pricePeriod =
                    plan.planCode === "PRO_MONTHLY"
                      ? "/ month"
                      : plan.planCode === "PRO_ANNUAL"
                      ? "/ year"
                      : "one-time";

                  return (
                    <div key={plan.id} className={`plan-card ${plan.badge === "Popular" ? "featured" : ""}`}>
                      <div className="plan-badge-tag" style={{ background: "linear-gradient(135deg, #a855f7, #6366f1)" }}>
                        COMING SOON
                      </div>
                      <h3 className="plan-name">{plan.name}</h3>
                      <p className="plan-desc">{plan.description}</p>
                      <div className="plan-price">
                        <span className="price-amount">{displayPrice}</span>
                        <span className="price-period">{pricePeriod}</span>
                      </div>

                      <ul className="plan-features">
                        {plan.features.map((f, i) => (
                          <li key={i}>
                            <CheckIcon size={14} className="feature-check" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>

                      {plan.isCurrentPlan ? (
                        <button type="button" className="plan-btn current" disabled>
                          <CheckIcon size={16} />
                          <span>Current Active Plan</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="plan-btn unlock"
                          onClick={() => handleRazorpaySubscribe(plan)}
                          style={{
                            background: "rgba(168, 85, 247, 0.15)",
                            color: "#c084fc",
                            border: "1px solid rgba(168, 85, 247, 0.3)",
                            cursor: "pointer"
                          }}
                        >
                          <SparklesIcon size={16} />
                          <span>Coming Soon</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: AVATAR FRAMES */}
          {activeTab === "frames" && (
            <div className="items-grid">
              {catalog.avatarFrames.map((frame) => {
                const isActive = profile?.avatarDecoration === frame.id;
                return (
                  <div key={frame.id} className={`store-item-card ${isActive ? "active-equipped" : ""}`}>
                    {frame.isProExclusive && (
                      <div className="item-pro-tag">
                        <SparklesIcon size={12} /> PRO EXCLUSIVE
                      </div>
                    )}
                    <div className="item-preview-area">
                      <AvatarFrame
                        src={profile?.avatar || ""}
                        fallbackText={profile?.displayName || "A"}
                        size={72}
                        frame={frame.id}
                      />
                    </div>
                    <div className="item-meta">
                      <h4 className="item-title">{frame.name}</h4>
                      <p className="item-description">{frame.description}</p>
                    </div>

                    <div className="item-actions">
                      {isActive ? (
                        <button
                          type="button"
                          className="item-btn unequip"
                          onClick={() => handleUnequip("AVATAR_FRAME")}
                          disabled={activatingId === "AVATAR_FRAME"}
                        >
                          Unequip Frame
                        </button>
                      ) : frame.isOwned ? (
                        <button
                          type="button"
                          className="item-btn equip"
                          onClick={() => handleEquip("AVATAR_FRAME", frame.id)}
                          disabled={activatingId === frame.id}
                        >
                          {activatingId === frame.id ? <LoaderIcon size={14} /> : "Equip Frame"}
                        </button>
                      ) : frame.isLocked ? (
                        <button
                          type="button"
                          className="item-btn locked"
                          onClick={() => setActiveTab("plans")}
                        >
                          <LockIcon size={14} /> Requires Pro
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="item-btn unlock"
                          onClick={() => setSelectedItem(frame)}
                        >
                          Unlock Free
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 3: PROFILE THEMES */}
          {activeTab === "themes" && (
            <div className="items-grid">
              {catalog.profileThemes.map((theme) => {
                const isActive = profile?.profileTheme === theme.id;
                return (
                  <div key={theme.id} className={`store-item-card ${isActive ? "active-equipped" : ""}`}>
                    {theme.isProExclusive && (
                      <div className="item-pro-tag">
                        <SparklesIcon size={12} /> PRO EXCLUSIVE
                      </div>
                    )}
                    <div className={`theme-palette-preview ${theme.themeClass}`}>
                      <div className="palette-chip chip-1" />
                      <div className="palette-chip chip-2" />
                      <div className="palette-chip chip-3" />
                    </div>
                    <div className="item-meta">
                      <h4 className="item-title">{theme.name}</h4>
                      <p className="item-description">{theme.description}</p>
                    </div>

                    <div className="item-actions">
                      {isActive ? (
                        <button
                          type="button"
                          className="item-btn unequip"
                          onClick={() => handleUnequip("PROFILE_THEME")}
                          disabled={activatingId === "PROFILE_THEME"}
                        >
                          Reset to Default
                        </button>
                      ) : theme.isOwned ? (
                        <button
                          type="button"
                          className="item-btn equip"
                          onClick={() => handleEquip("PROFILE_THEME", theme.id)}
                          disabled={activatingId === theme.id}
                        >
                          {activatingId === theme.id ? <LoaderIcon size={14} /> : "Apply Theme"}
                        </button>
                      ) : theme.isLocked ? (
                        <button
                          type="button"
                          className="item-btn locked"
                          onClick={() => setActiveTab("plans")}
                        >
                          <LockIcon size={14} /> Requires Pro
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="item-btn unlock"
                          onClick={() => setSelectedItem(theme)}
                        >
                          Unlock Free
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 4: PROFILE DECORATIONS */}
          {activeTab === "decorations" && (
            <div className="items-grid">
              {catalog.profileDecorations.map((deco) => {
                const isActive = profile?.profileDecoration === deco.id;
                return (
                  <div key={deco.id} className={`store-item-card ${isActive ? "active-equipped" : ""}`}>
                    {deco.isProExclusive && (
                      <div className="item-pro-tag">
                        <SparklesIcon size={12} /> PRO EXCLUSIVE
                      </div>
                    )}
                    <div className="deco-preview-badge">✨ {deco.name}</div>
                    <div className="item-meta">
                      <h4 className="item-title">{deco.name}</h4>
                      <p className="item-description">{deco.description}</p>
                    </div>

                    <div className="item-actions">
                      {isActive ? (
                        <button
                          type="button"
                          className="item-btn unequip"
                          onClick={() => handleUnequip("PROFILE_DECORATION")}
                          disabled={activatingId === "PROFILE_DECORATION"}
                        >
                          Remove Decoration
                        </button>
                      ) : deco.isOwned ? (
                        <button
                          type="button"
                          className="item-btn equip"
                          onClick={() => handleEquip("PROFILE_DECORATION", deco.id)}
                          disabled={activatingId === deco.id}
                        >
                          {activatingId === deco.id ? <LoaderIcon size={14} /> : "Equip Decoration"}
                        </button>
                      ) : deco.isLocked ? (
                        <button
                          type="button"
                          className="item-btn locked"
                          onClick={() => setActiveTab("plans")}
                        >
                          <LockIcon size={14} /> Requires Pro
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="item-btn unlock"
                          onClick={() => setSelectedItem(deco)}
                        >
                          Unlock Free
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 5: EMOJI PACKS */}
          {activeTab === "emojis" && (
            <div className="items-grid">
              {catalog.emojiPacks.map((pack) => (
                <div key={pack.id} className="store-item-card">
                  {pack.isProExclusive && (
                    <div className="item-pro-tag">
                      <SparklesIcon size={12} /> PRO PACK
                    </div>
                  )}
                  <div className="emoji-pack-preview-row">
                    {pack.emojis.map((emoji, idx) => (
                      <span key={idx} className="emoji-preview-item">{emoji}</span>
                    ))}
                  </div>
                  <div className="item-meta">
                    <h4 className="item-title">{pack.name}</h4>
                    <p className="item-description">{pack.description}</p>
                  </div>

                  <div className="item-actions">
                    {pack.isOwned ? (
                      <button type="button" className="item-btn owned" disabled>
                        <CheckIcon size={14} /> Ready to Use
                      </button>
                    ) : pack.isLocked ? (
                      <button
                        type="button"
                        className="item-btn locked"
                        onClick={() => setActiveTab("plans")}
                      >
                        <LockIcon size={14} /> Requires Pro
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="item-btn unlock"
                        onClick={() => setSelectedItem(pack)}
                      >
                        Unlock Pack Free
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: MY INVENTORY & ORDERS */}
          {activeTab === "inventory" && inventory && (
            <div className="inventory-section">
              <div className="inventory-summary-card">
                <h3>Active Customizations</h3>
                <div className="active-custom-list">
                  <div className="custom-slot">
                    <span className="slot-label">Avatar Frame:</span>
                    <span className="slot-value">{inventory.activeCustomizations.avatarDecoration || "None (Default)"}</span>
                    {inventory.activeCustomizations.avatarDecoration && (
                      <button type="button" className="slot-clear-btn" onClick={() => handleUnequip("AVATAR_FRAME")}>Clear</button>
                    )}
                  </div>
                  <div className="custom-slot">
                    <span className="slot-label">Profile Theme:</span>
                    <span className="slot-value">{inventory.activeCustomizations.profileTheme || "Default Theme"}</span>
                    {inventory.activeCustomizations.profileTheme !== "default" && (
                      <button type="button" className="slot-clear-btn" onClick={() => handleUnequip("PROFILE_THEME")}>Reset</button>
                    )}
                  </div>
                  <div className="custom-slot">
                    <span className="slot-label">Profile Decoration:</span>
                    <span className="slot-value">{inventory.activeCustomizations.profileDecoration || "None"}</span>
                    {inventory.activeCustomizations.profileDecoration && (
                      <button type="button" className="slot-clear-btn" onClick={() => handleUnequip("PROFILE_DECORATION")}>Clear</button>
                    )}
                  </div>
                </div>
              </div>

              {/* Razorpay Orders History */}
              <h3 style={{ marginTop: 28, marginBottom: 14 }}>Razorpay Orders & Subscriptions</h3>
              {paymentHistory && paymentHistory.length > 0 ? (
                <div className="purchase-history-table">
                  {paymentHistory.map((p) => (
                    <div key={p._id} className="history-row">
                      <div className="history-meta">
                        <strong>{p.plan}</strong>
                        <span className="history-type">₹{(p.amount / 100).toFixed(2)} {p.currency}</span>
                      </div>
                      <div className="history-txn">
                        <span>Order: {p.razorpayOrderId}</span>
                        {p.razorpayPaymentId && <span>Payment: {p.razorpayPaymentId}</span>}
                        <span className="history-date">{new Date(p.createdAt).toLocaleString()}</span>
                      </div>
                      <div className={`history-status ${p.status === "paid" ? "status-completed" : "status-pending"}`}>
                        {p.status.toUpperCase()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-history-notice">
                  <p>No verified Razorpay transactions yet.</p>
                </div>
              )}

              {/* Cosmetic Unlock History */}
              <h3 style={{ marginTop: 28, marginBottom: 14 }}>Cosmetic Items Unlocked</h3>
              {inventory.purchases && inventory.purchases.length > 0 ? (
                <div className="purchase-history-table">
                  {inventory.purchases.map((p) => (
                    <div key={p._id} className="history-row">
                      <div className="history-meta">
                        <strong>{p.itemName}</strong>
                        <span className="history-type">({p.itemType})</span>
                      </div>
                      <div className="history-txn">
                        <span>{p.transactionId}</span>
                        <span className="history-date">{new Date(p.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="history-status status-completed">
                        {p.provider} ({p.paymentStatus})
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-history-notice">
                  <p>No item unlocks yet. Explore the tabs above to unlock styles!</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* COSMETIC UNLOCK MODAL */}
      {selectedItem && (
        <div className="modal-backdrop">
          <div className="modal-content checkout-modal">
            <div className="modal-header">
              <h3>Unlock {selectedItem.name}</h3>
              <button type="button" className="modal-close-btn" onClick={() => setSelectedItem(null)}>
                <XIcon size={18} />
              </button>
            </div>

            <div className="checkout-body">
              <div className="mock-gateway-notice">
                <ShieldIcon size={20} className="shield-icon" />
                <div>
                  <strong>Cosmetic Item Unlock</strong>
                  <p>Unlock this cosmetic asset for your ANOY profile.</p>
                </div>
              </div>

              <div className="checkout-order-summary">
                <div className="summary-line">
                  <span>Item:</span>
                  <strong>{selectedItem.name}</strong>
                </div>
                <div className="summary-line">
                  <span>Type:</span>
                  <span>{selectedItem.type}</span>
                </div>
                <div className="summary-line total">
                  <span>Price:</span>
                  <span className="price-free">Free (Community Unlock)</span>
                </div>
              </div>

              <div className="checkout-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setSelectedItem(null)}
                  disabled={purchasingCosmetic}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-confirm-purchase"
                  onClick={handleConfirmCosmeticUnlock}
                  disabled={purchasingCosmetic}
                >
                  {purchasingCosmetic ? <LoaderIcon size={18} /> : "Confirm Unlock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
