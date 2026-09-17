import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { communityApi, communityChatApi, meetingRoomApi, mediaApi, postApi } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../context/ToastContext";
import ProBadge from "../components/ProBadge";
import AvatarFrame from "../components/AvatarFrame";
import PostCard from "../components/PostCard";
import PostComposer from "../components/PostComposer";
import ImageLightboxModal from "../components/ImageLightboxModal";
import {
  UsersIcon,
  UserIcon,
  SparklesIcon,
  ShieldIcon,
  TrashIcon,
  LoaderIcon,
  XIcon,
  SendIcon,
  PaperclipIcon,
  MessageCircleIcon,
  HashIcon,
  LockIcon,
  PlusIcon,
  CameraIcon,
  SearchIcon,
  GraduationCapIcon,
  VideoIcon,
  MoreVerticalIcon,
  AlertTriangleIcon,
  CheckIcon,
  CheckCircleIcon,
  UserPlusIcon,
  UserMinusIcon,
  ClockIcon,
  FileTextIcon,
  BanIcon,
  SlidersIcon,
  SettingsIcon,
  GlobeIcon
} from "../components/Icons";

const COMMUNITY_CHANNELS = [
  { id: "general", label: "general", desc: "General chat & discussions" },
  { id: "announcements", label: "announcements", desc: "Updates & notices" },
  { id: "study-lounge", label: "study-lounge", desc: "Study questions & help" }
];

export default function CommunityDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { socket, isConnected } = useSocket();
  const { addToast } = useToast();

  const [community, setCommunity] = useState(null);
  const [boosters, setBoosters] = useState([]);
  const [posts, setPosts] = useState([]);
  const [activeTab, setActiveTab] = useState("chat"); // 'chat' | 'feed' | 'members' | 'moderation' | 'rooms'
  const [loading, setLoading] = useState(true);
  const [boosting, setBoosting] = useState(false);
  const [showBoostModal, setShowBoostModal] = useState(false);

  // Members Tab State
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("ALL");
  const [memberCounts, setMemberCounts] = useState({ all: 0, owners: 0, moderators: 0, members: 0 });
  const [activeDropdownUser, setActiveDropdownUser] = useState(null);

  // Moderation Dashboard State
  const [modSubtab, setModSubtab] = useState("overview"); // 'overview' | 'members' | 'reports' | 'banned' | 'history' | 'settings'
  const [bannedUsers, setBannedUsers] = useState([]);
  const [loadingBanned, setLoadingBanned] = useState(false);
  const [modLogs, setModLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState("ALL");
  const [resolutionNotesMap, setResolutionNotesMap] = useState({});
  const [resolvingReportId, setResolvingReportId] = useState(null);
  const [modTargetUsername, setModTargetUsername] = useState("");
  const [addingMod, setAddingMod] = useState(false);

  // Community Settings State
  const [settingsForm, setSettingsForm] = useState({
    name: "",
    description: "",
    isPrivate: false,
    allowMemberPosts: true
  });
  const [savingSettings, setSavingSettings] = useState(false);

  // Ban Modal State
  const [banModalUser, setBanModalUser] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [banningUser, setBanningUser] = useState(false);

  // Report Modal State
  const [reportModalUser, setReportModalUser] = useState(null);
  const [reportReason, setReportReason] = useState("Violation of community rules");
  const [reportDetails, setReportDetails] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  // Community Chat State
  const [activeChannel, setActiveChannel] = useState("general");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [lightboxData, setLightboxData] = useState({ isOpen: false, url: "", name: "" });

  const chatFileInputRef = useRef(null);
  const chatMessagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  // Meeting Rooms State
  const [meetingRooms, setMeetingRooms] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomMax, setNewRoomMax] = useState(5);
  const [newRoomPrivate, setNewRoomPrivate] = useState(false);
  const [newRoomPasscode, setNewRoomPasscode] = useState("");
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Passcode prompt for locked meeting rooms
  const [promptRoom, setPromptRoom] = useState(null);
  const [enteredPasscode, setEnteredPasscode] = useState("");
  const [joiningRoom, setJoiningRoom] = useState(false);

  const isProUser = Boolean(
    profile?.isPro && (!profile?.proExpiresAt || new Date(profile?.proExpiresAt) > new Date())
  );

  const fetchCommunityData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await communityApi.getCommunity(slug);
      if (res.data.success) {
        setCommunity(res.data.community);

        // Fetch boosters
        try {
          const bRes = await communityApi.getBoosters(res.data.community._id);
          if (bRes.data.success) {
            setBoosters(bRes.data.boosters);
          }
        } catch {
          // ignore
        }

        // Fetch posts for feed
        try {
          const pRes = await postApi.getExploreFeed(1, 10);
          if (pRes.data.success) {
            setPosts(pRes.data.posts || []);
          }
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.error("Fetch community error:", err);
      addToast(err.response?.data?.message || "Community not found", "error");
      navigate("/communities");
    } finally {
      setLoading(false);
    }
  }, [slug, navigate, addToast]);

  useEffect(() => {
    fetchCommunityData();
  }, [fetchCommunityData]);

  // Scroll chat to bottom
  const scrollChatToBottom = (behavior = "smooth") => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Fetch channel messages
  const fetchChannelMessages = useCallback(
    async (channelName) => {
      if (!community?._id) return;
      try {
        setChatLoading(true);
        const res = await communityChatApi.getMessages(community._id, channelName, 1, 50);
        if (res.data.success) {
          setChatMessages(res.data.messages || []);
          setTimeout(() => scrollChatToBottom("auto"), 50);
        }
      } catch (err) {
        console.warn("Fetch community messages error:", err);
      } finally {
        setChatLoading(false);
      }
    },
    [community]
  );

  // When community or activeChannel changes, join socket room & fetch messages
  useEffect(() => {
    if (!community?._id || activeTab !== "chat") return;

    fetchChannelMessages(activeChannel);
    setSelectedImage(null);
    setImagePreview(null);
    setTypingUsers(new Set());

    if (socket && isConnected) {
      socket.emit("join_community_chat", {
        communityId: community._id,
        channel: activeChannel
      });
    }

    return () => {
      if (socket && isConnected) {
        socket.emit("leave_community_chat", {
          communityId: community._id,
          channel: activeChannel
        });
      }
    };
  }, [community?._id, activeChannel, activeTab, socket, isConnected, fetchChannelMessages]);

  // Socket event listeners for community chat
  useEffect(() => {
    if (!socket || !community?._id) return;

    const handleNewCommunityMsg = ({ communityId, channel, message }) => {
      if (communityId === community._id && channel === activeChannel) {
        setChatMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        setTimeout(() => scrollChatToBottom("smooth"), 50);
      }
    };

    const handleCommunityMsgDeleted = ({ communityId, channel, messageId }) => {
      if (communityId === community._id && channel === activeChannel) {
        setChatMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
    };

    const handleTypingStart = ({ communityId, channel, userId, displayName, username }) => {
      if (communityId === community._id && channel === activeChannel && userId !== user?.id && userId !== user?._id) {
        setTypingUsers((prev) => new Set([...prev, displayName || username]));
        setTimeout(() => scrollChatToBottom("smooth"), 50);
      }
    };

    const handleTypingStop = ({ communityId, channel, displayName, username }) => {
      if (communityId === community._id && channel === activeChannel) {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(displayName || username);
          return next;
        });
      }
    };

    socket.on("new_community_message", handleNewCommunityMsg);
    socket.on("community_message_deleted", handleCommunityMsgDeleted);
    socket.on("community_typing:start", handleTypingStart);
    socket.on("community_typing:stop", handleTypingStop);

    return () => {
      socket.off("new_community_message", handleNewCommunityMsg);
      socket.off("community_message_deleted", handleCommunityMsgDeleted);
      socket.off("community_typing:start", handleTypingStart);
      socket.off("community_typing:stop", handleTypingStop);
    };
  }, [socket, community?._id, activeChannel, user]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Please select an image file (JPG, PNG, WEBP, GIF).", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size must be less than 5MB.", "error");
      return;
    }

    setSelectedImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleCancelImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (chatFileInputRef.current) {
      chatFileInputRef.current.value = "";
    }
  };

  const handleChatInputChange = (e) => {
    setChatInput(e.target.value);
    if (!socket || !isConnected || !community?._id) return;

    socket.emit("community_typing:start", {
      communityId: community._id,
      channel: activeChannel
    });

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit("community_typing:stop", {
        communityId: community._id,
        channel: activeChannel
      });
    }, 2000);
  };

  const handleSendCommunityMessage = async (e) => {
    e.preventDefault();
    if ((!chatInput.trim() && !selectedImage) || !community?._id || chatSending) return;

    try {
      setChatSending(true);

      let uploadedMedia = null;
      if (selectedImage) {
        const formData = new FormData();
        formData.append("image", selectedImage);
        const uploadRes = await mediaApi.uploadImage(formData);
        if (uploadRes.data.success) {
          uploadedMedia = uploadRes.data.media;
        } else {
          throw new Error("Failed to upload image.");
        }
      }

      const payload = {
        communityId: community._id,
        channel: activeChannel,
        content: chatInput.trim(),
        messageType: uploadedMedia ? "IMAGE" : "TEXT",
        mediaUrl: uploadedMedia?.url || "",
        mediaMeta: uploadedMedia || {}
      };

      if (socket && isConnected) {
        socket.emit("send_community_message", payload, (res) => {
          if (!res?.success) {
            communityChatApi.sendMessage(community._id, payload);
          }
        });
      } else {
        const res = await communityChatApi.sendMessage(community._id, payload);
        if (res.data.success) {
          setChatMessages((prev) => [...prev, res.data.message]);
          setTimeout(() => scrollChatToBottom("smooth"), 50);
        }
      }

      setChatInput("");
      handleCancelImage();
    } catch (err) {
      console.error("Send community message error:", err);
      addToast(err.response?.data?.message || err.message || "Failed to send message", "error");
    } finally {
      setChatSending(false);
    }
  };

  const handleDeleteCommunityMessage = async (messageId) => {
    if (!window.confirm("Delete this message?")) return;

    try {
      if (socket && isConnected) {
        socket.emit("delete_community_message", {
          communityId: community._id,
          channel: activeChannel,
          messageId
        });
      } else {
        await communityChatApi.deleteMessage(community._id, messageId);
        setChatMessages((prev) => prev.filter((m) => m._id !== messageId));
      }
      addToast("Message deleted", "info");
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete message", "error");
    }
  };

  const handleJoinLeave = async () => {
    if (!community) return;
    try {
      if (community.userRole === "NONE") {
        const res = await communityApi.joinCommunity(community._id);
        if (res.data.success) {
          addToast(`Joined ${community.name}!`, "success");
          fetchCommunityData();
        }
      } else {
        const res = await communityApi.leaveCommunity(community._id);
        if (res.data.success) {
          addToast(`Left ${community.name}`, "info");
          fetchCommunityData();
        }
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Action failed", "error");
    }
  };

  const handleBoost = async () => {
    if (!community) return;
    if (!isProUser) {
      addToast("You must be an ANOY Pro member to boost communities! Pro memberships are launching soon.", "warning");
      navigate("/store");
      return;
    }

    try {
      setBoosting(true);
      const res = await communityApi.boostCommunity(community._id);
      if (res.data.success) {
        addToast(res.data.message || "Community boosted!", "success");
        setShowBoostModal(false);
        fetchCommunityData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to boost community", "error");
    } finally {
      setBoosting(false);
    }
  };

  // Fetch members with query and role filter
  const fetchMembers = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingMembers(true);
      const res = await communityApi.getMembers(community._id, {
        q: memberSearchQuery,
        role: selectedRoleFilter !== "ALL" ? selectedRoleFilter : undefined
      });
      if (res.data.success) {
        setMembers(res.data.members || []);
        if (res.data.counts) setMemberCounts(res.data.counts);
      }
    } catch (err) {
      console.warn("Fetch members error:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [community?._id, memberSearchQuery, selectedRoleFilter]);

  // Fetch banned users
  const fetchBannedUsers = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingBanned(true);
      const res = await communityApi.getBannedMembers(community._id);
      if (res.data.success) {
        setBannedUsers(res.data.bannedUsers || []);
      }
    } catch (err) {
      console.warn("Fetch banned users error:", err);
    } finally {
      setLoadingBanned(false);
    }
  }, [community?._id]);

  // Fetch moderation logs
  const fetchModLogs = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingLogs(true);
      const res = await communityApi.getModerationLogs(community._id);
      if (res.data.success) {
        setModLogs(res.data.logs || []);
      }
    } catch (err) {
      console.warn("Fetch mod logs error:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [community?._id]);

  // Fetch reports
  const fetchReports = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingReports(true);
      const res = await communityApi.getReports(community._id, {
        status: reportStatusFilter !== "ALL" ? reportStatusFilter : undefined
      });
      if (res.data.success) {
        setReports(res.data.reports || []);
      }
    } catch (err) {
      console.warn("Fetch reports error:", err);
    } finally {
      setLoadingReports(false);
    }
  }, [community?._id, reportStatusFilter]);

  // Fetch data on tab / subtab changes
  useEffect(() => {
    if (activeTab === "members" || (activeTab === "moderation" && modSubtab === "members")) {
      fetchMembers();
    }
  }, [activeTab, modSubtab, fetchMembers]);

  useEffect(() => {
    if (activeTab === "moderation") {
      if (modSubtab === "overview") {
        fetchBannedUsers();
        fetchReports();
        fetchModLogs();
      } else if (modSubtab === "banned") {
        fetchBannedUsers();
      } else if (modSubtab === "history") {
        fetchModLogs();
      } else if (modSubtab === "reports") {
        fetchReports();
      } else if (modSubtab === "settings" && community) {
        setSettingsForm({
          name: community.name || "",
          description: community.description || "",
          isPrivate: Boolean(community.isPrivate),
          allowMemberPosts: community.settings?.allowMemberPosts !== false
        });
      }
    }
  }, [activeTab, modSubtab, community, fetchBannedUsers, fetchReports, fetchModLogs]);

  const handleAddModerator = async (e) => {
    e.preventDefault();
    if (!modTargetUsername.trim()) return;

    try {
      setAddingMod(true);
      const res = await communityApi.addModerator(community._id, undefined, modTargetUsername.trim());
      if (res.data.success) {
        addToast(res.data.message || "Moderator added!", "success");
        setModTargetUsername("");
        fetchCommunityData();
        fetchMembers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to add moderator", "error");
    } finally {
      setAddingMod(false);
    }
  };

  const handlePromoteModerator = async (targetUserId, targetUsername) => {
    try {
      const res = await communityApi.addModerator(community._id, targetUserId);
      if (res.data.success) {
        addToast(`@${targetUsername} is now a Moderator!`, "success");
        fetchCommunityData();
        fetchMembers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to promote moderator", "error");
    } finally {
      setActiveDropdownUser(null);
    }
  };

  const handleRemoveModerator = async (targetUserId, targetUsername) => {
    try {
      const res = await communityApi.removeModerator(community._id, targetUserId);
      if (res.data.success) {
        addToast(`@${targetUsername || "user"} demoted to Member`, "info");
        fetchCommunityData();
        fetchMembers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to demote moderator", "error");
    } finally {
      setActiveDropdownUser(null);
    }
  };

  const handleRemoveMember = async (targetUserId, targetUsername) => {
    if (!window.confirm(`Are you sure you want to remove @${targetUsername} from the community?`)) return;
    try {
      const res = await communityApi.removeMember(community._id, targetUserId);
      if (res.data.success) {
        addToast(`Removed @${targetUsername} from community`, "info");
        fetchCommunityData();
        fetchMembers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to remove member", "error");
    } finally {
      setActiveDropdownUser(null);
    }
  };

  const handleConfirmBan = async (e) => {
    e.preventDefault();
    if (!banModalUser || banningUser) return;
    try {
      setBanningUser(true);
      const res = await communityApi.banMember(community._id, banModalUser._id, banReason);
      if (res.data.success) {
        addToast(`Banned @${banModalUser.username} from community`, "success");
        setBanModalUser(null);
        setBanReason("");
        fetchCommunityData();
        fetchMembers();
        fetchBannedUsers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to ban member", "error");
    } finally {
      setBanningUser(false);
    }
  };

  const handleUnbanMember = async (targetUserId, targetUsername) => {
    try {
      const res = await communityApi.unbanMember(community._id, targetUserId);
      if (res.data.success) {
        addToast(`Unbanned @${targetUsername || "user"}`, "success");
        fetchBannedUsers();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to unban user", "error");
    }
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportModalUser || submittingReport) return;
    try {
      setSubmittingReport(true);
      const res = await communityApi.createReport(community._id, {
        targetUserId: reportModalUser._id,
        reason: reportReason,
        details: reportDetails
      });
      if (res.data.success) {
        addToast("Report submitted to community moderators", "success");
        setReportModalUser(null);
        setReportReason("Violation of community rules");
        setReportDetails("");
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to submit report", "error");
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleResolveReport = async (reportId, status) => {
    try {
      setResolvingReportId(reportId);
      const notes = resolutionNotesMap[reportId] || "";
      const res = await communityApi.resolveReport(community._id, reportId, {
        status,
        resolutionNotes: notes
      });
      if (res.data.success) {
        addToast(res.data.message || `Report ${status.toLowerCase()}`, "success");
        fetchReports();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to resolve report", "error");
    } finally {
      setResolvingReportId(null);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!community?._id || savingSettings) return;
    try {
      setSavingSettings(true);
      const res = await communityApi.updateCommunity(community._id, {
        name: settingsForm.name,
        description: settingsForm.description,
        isPrivate: settingsForm.isPrivate,
        settings: {
          allowMemberPosts: settingsForm.allowMemberPosts
        }
      });
      if (res.data.success) {
        addToast("Community settings saved!", "success");
        fetchCommunityData();
        fetchModLogs();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Fetch meeting rooms for this community
  const fetchMeetingRooms = useCallback(async () => {
    if (!community?._id) return;
    try {
      setLoadingRooms(true);
      const res = await meetingRoomApi.getCommunityRooms(community._id);
      if (res.data.success) {
        setMeetingRooms(res.data.meetingRooms || []);
      }
    } catch (err) {
      console.warn("Fetch meeting rooms error:", err);
    } finally {
      setLoadingRooms(false);
    }
  }, [community?._id]);

  useEffect(() => {
    if (activeTab === "rooms") {
      fetchMeetingRooms();
    }
  }, [activeTab, fetchMeetingRooms]);

  const handleCreateMeetingRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName.trim() || !community?._id || creatingRoom) return;

    const maxAllowed = isProUser ? 15 : 5;
    const requestedMax = Math.min(Math.max(Number(newRoomMax) || maxAllowed, 2), maxAllowed);

    try {
      setCreatingRoom(true);
      const payload = {
        name: newRoomName.trim(),
        description: newRoomDesc.trim(),
        maxParticipants: requestedMax,
        isPrivate: Boolean(newRoomPrivate),
        passcode: newRoomPrivate ? newRoomPasscode.trim() : ""
      };

      const res = await meetingRoomApi.createRoom(community._id, payload);
      if (res.data.success) {
        addToast("Meeting room created!", "success");
        setShowCreateRoomModal(false);
        setNewRoomName("");
        setNewRoomDesc("");
        setNewRoomMax(isProUser ? 15 : 5);
        setNewRoomPrivate(false);
        setNewRoomPasscode("");
        fetchMeetingRooms();

        navigate(`/communities/${slug}/meeting-rooms/${res.data.meetingRoom._id}`, {
          state: { passcode: payload.passcode }
        });
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to create meeting room", "error");
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleJoinMeetingRoomClick = (room) => {
    const activeCount = room.activeParticipants?.length || 0;
    const maxCapacity = room.maxParticipants || (room.isHostPro ? 15 : 5);

    if (activeCount >= maxCapacity) {
      addToast(
        `This meeting room is full (${maxCapacity} max participants for ${room.isHostPro ? "ANOY Pro" : "Free"} host)`,
        "error"
      );
      return;
    }

    if (room.isPrivate && room.hasPasscode) {
      setPromptRoom(room);
      setEnteredPasscode("");
    } else {
      navigate(`/communities/${slug}/meeting-rooms/${room._id}`);
    }
  };

  const handlePasscodeSubmit = async (e) => {
    e.preventDefault();
    if (!promptRoom || joiningRoom) return;

    try {
      setJoiningRoom(true);
      const res = await meetingRoomApi.joinRoom(promptRoom._id, enteredPasscode);
      if (res.data.success) {
        const targetRoomId = promptRoom._id;
        const passcode = enteredPasscode;
        setPromptRoom(null);
        setEnteredPasscode("");
        navigate(`/communities/${slug}/meeting-rooms/${targetRoomId}`, {
          state: { passcode }
        });
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Incorrect passcode", "error");
    } finally {
      setJoiningRoom(false);
    }
  };

  const handleDeleteMeetingRoom = async (roomId, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to end/delete this meeting room?")) return;

    try {
      const res = await meetingRoomApi.deleteRoom(roomId);
      if (res.data.success) {
        addToast("Meeting room closed", "info");
        fetchMeetingRooms();
      }
    } catch (err) {
      addToast(err.response?.data?.message || "Failed to delete meeting room", "error");
    }
  };

  const filteredMeetingRooms = meetingRooms.filter((r) => {
    if (!roomSearchQuery.trim()) return true;
    const q = roomSearchQuery.toLowerCase();
    return (
      (r.name || "").toLowerCase().includes(q) ||
      (r.description || "").toLowerCase().includes(q)
    );
  });

  if (loading || !community) {
    return (
      <div className="community-loading-state">
        <LoaderIcon size={36} />
        <span>Loading community...</span>
      </div>
    );
  }

  const isOwner = community.userRole === "OWNER";
  const isMod = community.userRole === "MODERATOR" || isOwner;
  const isMember = community.userRole !== "NONE";

  return (
    <div className="community-detail-page">
      {/* Lightbox for Image viewing */}
      <ImageLightboxModal
        isOpen={lightboxData.isOpen}
        imageUrl={lightboxData.url}
        originalName={lightboxData.name}
        onClose={() => setLightboxData({ isOpen: false, url: "", name: "" })}
      />

      {/* Hidden File Picker for Community Chat */}
      <input
        type="file"
        ref={chatFileInputRef}
        onChange={handleFileChange}
        accept="image/jpeg,image/png,image/webp,image/gif"
        style={{ display: "none" }}
      />

      {/* Cover Banner */}
      <div
        className="community-cover-banner"
        style={{
          backgroundImage: community.coverImage ? `url(${community.coverImage})` : undefined,
          background: !community.coverImage ? "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)" : undefined
        }}
      >
        {community.isBoosted && (
          <div className="banner-boost-pill">
            🚀 Boosted Level {community.boostLevel} ({community.boostCount} Boosts)
          </div>
        )}
      </div>

      {/* Header Info */}
      <div className="community-header-card">
        <div className="comm-header-top-row">
          <div className="comm-header-avatar-col">
            <div className={`comm-detail-avatar ${community.activeDecorations?.iconFrame || ""}`}>
              {community.avatar ? (
                <img src={community.avatar} alt={community.name} />
              ) : (
                <span>{community.name.charAt(0).toUpperCase()}</span>
              )}
            </div>
          </div>

          <div className="comm-header-actions">
            <button
              type="button"
              className="btn-boost-comm"
              onClick={() => setShowBoostModal(true)}
            >
              <SparklesIcon size={16} />
              <span>Boost Community</span>
            </button>

            {isOwner ? (
              <span className="role-owner-pill">Owner</span>
            ) : (
              <button
                type="button"
                className={`btn-join-toggle ${community.userRole !== "NONE" ? "joined" : "join"}`}
                onClick={handleJoinLeave}
              >
                {community.userRole !== "NONE" ? "Joined" : "Join Community"}
              </button>
            )}
          </div>
        </div>

        <div className="comm-header-details">
          <div className="comm-title-row">
            <h1 className="comm-main-title">{community.name}</h1>
            {community.isPrivate && (
              <span className="private-comm-pill" title="Private Community">
                <LockIcon size={13} /> Private
              </span>
            )}
            {community.isBoosted && (
              <span className="boost-lvl-badge">Level {community.boostLevel}</span>
            )}
          </div>
          <span className="comm-slug-handle">@{community.slug}</span>
          <p className="comm-full-desc">{community.description || "Welcome to our community on ANOY."}</p>

          <div className="comm-meta-badges">
            <div className="meta-badge">
              <UsersIcon size={15} />
              <span>{community.memberCount} Members</span>
            </div>
            <div className="meta-badge">
              <ShieldIcon size={15} />
              <span>Created by @{community.owner?.username}</span>
              {community.owner?.isPro && <ProBadge size="sm" />}
            </div>
            {community.isBoosted && (
              <div className="meta-badge boost-meta">
                <span>🚀 {community.boostCount} Total Boosts</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="comm-tabs-nav">
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💬 Live Chat
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "rooms" ? "active" : ""}`}
          onClick={() => setActiveTab("rooms")}
        >
          🎓 Meeting Rooms ({meetingRooms.length})
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "feed" ? "active" : ""}`}
          onClick={() => setActiveTab("feed")}
        >
          Discussion & Feed
        </button>
        <button
          type="button"
          className={`comm-tab-btn ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          Members ({community.memberCount})
        </button>
        {isMod && (
          <button
            type="button"
            className={`comm-tab-btn ${activeTab === "moderation" ? "active" : ""}`}
            onClick={() => setActiveTab("moderation")}
          >
            Moderation & Roles
          </button>
        )}
      </div>

      {/* TAB CONTENT */}
      <div className="comm-tab-content">
        {/* TAB 0: LIVE COMMUNITY CHAT */}
        {activeTab === "chat" && (
          <div className="comm-chat-container">
            {/* Left Channels Sidebar */}
            <div className="comm-channels-sidebar">
              <div className="comm-channels-header">
                <span>TEXT CHANNELS</span>
              </div>
              <div className="comm-channels-list">
                {COMMUNITY_CHANNELS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`comm-channel-btn ${activeChannel === ch.id ? "active" : ""}`}
                    onClick={() => setActiveChannel(ch.id)}
                  >
                    <HashIcon size={16} />
                    <span>{ch.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Right Chat Stream */}
            <div className="comm-chat-main">
              <div className="comm-chat-top-header">
                <HashIcon size={18} />
                <strong>{activeChannel}</strong>
                <span className="channel-desc">
                  {COMMUNITY_CHANNELS.find((c) => c.id === activeChannel)?.desc}
                </span>
              </div>

              {/* Message Stream */}
              <div className="comm-chat-stream">
                {chatLoading ? (
                  <div className="chat-loading-spinner">
                    <LoaderIcon size={28} />
                    <span>Loading channel messages...</span>
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="comm-chat-empty">
                    <MessageCircleIcon size={38} />
                    <h3>Welcome to #{activeChannel}!</h3>
                    <p>This is the start of the #{activeChannel} channel.</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => {
                    const isMine =
                      msg.sender?._id === user?.id ||
                      msg.sender?._id === user?._id ||
                      msg.sender?.username === user?.username;

                    const role = msg.sender?.communityRole;

                    return (
                      <div key={msg._id} className="comm-chat-message-row">
                        <AvatarFrame decoration={msg.sender?.avatarDecoration} size="sm">
                          {msg.sender?.avatar ? (
                            <img src={msg.sender.avatar} alt={msg.sender.displayName} className="comm-msg-avatar" />
                          ) : (
                            <div className="comm-msg-placeholder">
                              {(msg.sender?.displayName || msg.sender?.username || "U").charAt(0).toUpperCase()}
                            </div>
                          )}
                        </AvatarFrame>

                        <div className="comm-msg-content-wrapper">
                          <div className="comm-msg-header">
                            <span className="comm-msg-author">{msg.sender?.displayName || msg.sender?.username}</span>
                            {msg.sender?.isPro && <ProBadge size="sm" />}
                            {role === "OWNER" && <span className="comm-role-tag owner">👑 Owner</span>}
                            {role === "MODERATOR" && <span className="comm-role-tag mod">🛡️ Mod</span>}
                            <span className="comm-msg-time">
                              {new Date(msg.createdAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit"
                              })}
                            </span>

                            {/* Delete button if author or owner/mod */}
                            {(isMine || isMod) && (
                              <button
                                type="button"
                                className="comm-msg-delete-btn"
                                onClick={() => handleDeleteCommunityMessage(msg._id)}
                                title="Delete message"
                                aria-label="Delete message"
                              >
                                <TrashIcon size={13} />
                              </button>
                            )}
                          </div>

                          {msg.messageType === "IMAGE" && msg.mediaUrl && (
                            <div
                              className="comm-msg-image-box"
                              onClick={() =>
                                setLightboxData({
                                  isOpen: true,
                                  url: msg.mediaUrl,
                                  name: msg.mediaMeta?.originalName || "Community image"
                                })
                              }
                            >
                              <img src={msg.mediaUrl} alt="Attachment" className="comm-msg-attached-img" loading="lazy" />
                            </div>
                          )}

                          {msg.content && <p className="comm-msg-text">{msg.content}</p>}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Typing Indicator */}
                {typingUsers.size > 0 && (
                  <div className="comm-typing-indicator">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-names">
                      {Array.from(typingUsers).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing...
                    </span>
                  </div>
                )}

                <div ref={chatMessagesEndRef} />
              </div>

              {/* Image Preview before sending */}
              {imagePreview && (
                <div className="image-preview-bar">
                  <div className="image-preview-thumb-wrapper">
                    <img src={imagePreview} alt="Preview" className="image-preview-thumb" />
                    <button
                      type="button"
                      className="image-preview-cancel-btn"
                      onClick={handleCancelImage}
                      title="Remove image"
                      aria-label="Remove image"
                    >
                      <XIcon size={14} />
                    </button>
                  </div>
                  <div className="image-preview-details">
                    <span className="image-preview-name">{selectedImage?.name}</span>
                    <span className="image-preview-size">
                      {selectedImage?.size ? `${(selectedImage.size / 1024).toFixed(1)} KB` : ""}
                    </span>
                  </div>
                </div>
              )}

              {/* Chat Composer */}
              {community.isPrivate && !isMember ? (
                <div className="comm-chat-locked-bar">
                  <LockIcon size={16} />
                  <span>Join this community to send messages and share images in #{activeChannel}.</span>
                </div>
              ) : (
                <form className="comm-chat-composer" onSubmit={handleSendCommunityMessage}>
                  <button
                    type="button"
                    className="chat-attach-btn"
                    onClick={() => chatFileInputRef.current?.click()}
                    title="Share Image"
                    aria-label="Attach Image"
                    disabled={chatSending}
                  >
                    <PaperclipIcon size={18} />
                  </button>

                  <input
                    type="text"
                    className="comm-chat-input"
                    placeholder={`Message #${activeChannel}...`}
                    value={chatInput}
                    onChange={handleChatInputChange}
                    disabled={chatSending}
                  />

                  <button
                    type="submit"
                    className="comm-chat-send-btn"
                    disabled={(!chatInput.trim() && !selectedImage) || chatSending}
                    aria-label="Send message"
                  >
                    {chatSending ? <LoaderIcon size={16} /> : <SendIcon size={16} />}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* TAB 1: FEED */}
        {activeTab === "feed" && (
          <div className="comm-feed-layout">
            <PostComposer onPostCreated={(newPost) => setPosts([newPost, ...posts])} />
            <div className="comm-post-stream" style={{ marginTop: 20 }}>
              {posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onPostDeleted={(id) => setPosts(posts.filter((p) => p._id !== id))}
                />
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: MEMBERS */}
        {activeTab === "members" && (
          <div className="comm-members-layout">
            <div className="comm-members-toolbar">
              <div className="comm-members-search-box">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Search community members..."
                  value={memberSearchQuery}
                  onChange={(e) => setMemberSearchQuery(e.target.value)}
                />
                {memberSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMemberSearchQuery("")}
                    className="clear-search-btn"
                    style={{ background: "none", border: "none", color: "var(--text-dim)", cursor: "pointer" }}
                  >
                    <XIcon size={14} />
                  </button>
                )}
              </div>

              <div className="comm-role-filter-pills">
                <button
                  type="button"
                  className={`comm-role-pill-btn ${selectedRoleFilter === "ALL" ? "active" : ""}`}
                  onClick={() => setSelectedRoleFilter("ALL")}
                >
                  All ({memberCounts.all || community.memberCount || 0})
                </button>
                <button
                  type="button"
                  className={`comm-role-pill-btn ${selectedRoleFilter === "OWNER" ? "active" : ""}`}
                  onClick={() => setSelectedRoleFilter("OWNER")}
                >
                  👑 Owners ({memberCounts.owners || 1})
                </button>
                <button
                  type="button"
                  className={`comm-role-pill-btn ${selectedRoleFilter === "MODERATOR" ? "active" : ""}`}
                  onClick={() => setSelectedRoleFilter("MODERATOR")}
                >
                  🛡️ Moderators ({memberCounts.moderators || community.moderators?.length || 0})
                </button>
                <button
                  type="button"
                  className={`comm-role-pill-btn ${selectedRoleFilter === "MEMBER" ? "active" : ""}`}
                  onClick={() => setSelectedRoleFilter("MEMBER")}
                >
                  🎓 Members ({memberCounts.members || 0})
                </button>
              </div>
            </div>

            {loadingMembers ? (
              <div className="comm-rooms-loading">
                <LoaderIcon size={28} />
                <span>Loading community members...</span>
              </div>
            ) : members.length === 0 ? (
              <div className="comm-rooms-empty">
                <UsersIcon size={40} />
                <h3>No members found</h3>
                <p>Try clearing your search query or switching role filters.</p>
              </div>
            ) : (
              <div className="comm-members-grid">
                {members.map((member) => {
                  const isCurrentTarget = activeDropdownUser === member._id;
                  const isSelf = member._id === user?.id || member._id === user?._id;
                  const canManage = (isOwner && !isSelf) || (isMod && member.role === "MEMBER" && !isSelf);

                  return (
                    <div key={member._id} className="comm-member-card">
                      <div className="comm-member-top-row">
                        <Link to={`/profile/${member.username}`} className="comm-member-user-link">
                          <AvatarFrame frame={member.avatarDecoration} size="md">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.displayName} />
                            ) : (
                              (member.displayName || member.username || "U").charAt(0).toUpperCase()
                            )}
                          </AvatarFrame>
                          <div className="comm-member-names">
                            <div className="comm-member-name-row">
                              <span className="comm-member-display-name">{member.displayName || member.username}</span>
                              {member.isPro && <ProBadge size="sm" />}
                            </div>
                            <span className="comm-member-handle">@{member.username}</span>
                          </div>
                        </Link>

                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            className="comm-member-menu-btn"
                            onClick={() => setActiveDropdownUser(isCurrentTarget ? null : member._id)}
                            title="Member actions"
                            aria-label="Member actions"
                          >
                            <MoreVerticalIcon size={16} />
                          </button>

                          {isCurrentTarget && (
                            <div className="comm-member-dropdown">
                              <Link
                                to={`/profile/${member.username}`}
                                className="comm-dropdown-action"
                                onClick={() => setActiveDropdownUser(null)}
                              >
                                <UserIcon size={14} />
                                <span>View Profile</span>
                              </Link>

                              {isOwner && member.role === "MEMBER" && (
                                <button
                                  type="button"
                                  className="comm-dropdown-action"
                                  onClick={() => handlePromoteModerator(member._id, member.username)}
                                >
                                  <UserPlusIcon size={14} />
                                  <span>Promote to Mod</span>
                                </button>
                              )}

                              {isOwner && member.role === "MODERATOR" && (
                                <button
                                  type="button"
                                  className="comm-dropdown-action"
                                  onClick={() => handleRemoveModerator(member._id, member.username)}
                                >
                                  <UserMinusIcon size={14} />
                                  <span>Demote to Member</span>
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  className="comm-dropdown-action danger"
                                  onClick={() => handleRemoveMember(member._id, member.username)}
                                >
                                  <TrashIcon size={14} />
                                  <span>Remove from Community</span>
                                </button>
                              )}

                              {canManage && (
                                <button
                                  type="button"
                                  className="comm-dropdown-action danger"
                                  onClick={() => {
                                    setActiveDropdownUser(null);
                                    setBanModalUser(member);
                                    setBanReason("");
                                  }}
                                >
                                  <BanIcon size={14} />
                                  <span>Ban from Community</span>
                                </button>
                              )}

                              {!isSelf && (
                                <button
                                  type="button"
                                  className="comm-dropdown-action"
                                  onClick={() => {
                                    setActiveDropdownUser(null);
                                    setReportModalUser(member);
                                    setReportReason("Violation of community rules");
                                    setReportDetails("");
                                  }}
                                >
                                  <AlertTriangleIcon size={14} />
                                  <span>Report User</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <span className={`comm-member-role-tag ${member.role.toLowerCase()}`}>
                          {member.role === "OWNER" && "👑 Owner"}
                          {member.role === "MODERATOR" && "🛡️ Mod"}
                          {member.role === "MEMBER" && "🎓 Member"}
                        </span>
                        {member.joinedAt && (
                          <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                            Joined {new Date(member.joinedAt).toLocaleDateString([], { month: "short", year: "numeric" })}
                          </span>
                        )}
                      </div>

                      {member.bio && <p className="comm-member-bio">{member.bio}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB: MEETING ROOMS */}
        {activeTab === "rooms" && (
          <div className="comm-meeting-rooms-tab">
            <div className="comm-rooms-toolbar">
              <div className="comm-rooms-search">
                <SearchIcon size={16} />
                <input
                  type="text"
                  placeholder="Search meeting rooms..."
                  value={roomSearchQuery}
                  onChange={(e) => setRoomSearchQuery(e.target.value)}
                />
              </div>

              {(!community.isPrivate || isMember) && (
                <button
                  type="button"
                  className="btn-create-comm-room"
                  onClick={() => {
                    setNewRoomMax(isProUser ? 15 : 5);
                    setShowCreateRoomModal(true);
                  }}
                >
                  <PlusIcon size={16} />
                  <span>Create Meeting Room</span>
                </button>
              )}
            </div>

            {loadingRooms ? (
              <div className="comm-rooms-loading">
                <LoaderIcon size={30} />
                <span>Loading active meeting rooms...</span>
              </div>
            ) : filteredMeetingRooms.length === 0 ? (
              <div className="comm-rooms-empty">
                <GraduationCapIcon size={44} />
                <h3>No Active Meeting Rooms</h3>
                <p>
                  Create a room to collaborate, discuss coursework, or hold live team meetings with fellow members.
                </p>
                {(!community.isPrivate || isMember) && (
                  <button
                    type="button"
                    className="btn-create-first-room"
                    onClick={() => {
                      setNewRoomMax(isProUser ? 15 : 5);
                      setShowCreateRoomModal(true);
                    }}
                  >
                    + Start a Meeting Room
                  </button>
                )}
              </div>
            ) : (
              <div className="comm-rooms-grid">
                {filteredMeetingRooms.map((room) => {
                  const isCreator =
                    room.createdBy?._id === user?.id ||
                    room.createdBy?._id === user?._id ||
                    room.createdBy?.username === user?.username;

                  const canDelete = isCreator || isOwner || isMod;
                  const activeCount = room.activeParticipants?.length || 0;
                  const roomLimit = room.maxParticipants || (room.isHostPro ? 15 : 5);

                  return (
                    <div
                      key={room._id}
                      className="comm-room-card"
                      onClick={() => handleJoinMeetingRoomClick(room)}
                    >
                      <div className="comm-room-card-header">
                        <div className="comm-room-badge-row">
                          <span className="comm-room-live-pill">
                            <span className="live-dot" />
                            {activeCount} / {roomLimit} Online ({room.isHostPro ? "Pro" : "Free"})
                          </span>
                          <span className={`comm-room-tier-badge ${room.isHostPro ? "pro" : "free"}`}>
                            {room.isHostPro ? "👑 Pro Room (15 Max)" : "Free Room (5 Max)"}
                          </span>
                          {room.isPrivate && (
                            <span className="comm-room-locked-pill" title="Passcode protected">
                              <LockIcon size={12} /> Protected
                            </span>
                          )}
                        </div>

                        {canDelete && (
                          <button
                            type="button"
                            className="comm-room-del-btn"
                            onClick={(e) => handleDeleteMeetingRoom(room._id, e)}
                            title="End meeting room"
                          >
                            <TrashIcon size={14} />
                          </button>
                        )}
                      </div>

                      <h3 className="comm-room-title">{room.name}</h3>
                      <p className="comm-room-desc">
                        {room.description || "Live community meeting and video collaboration room."}
                      </p>

                      <div className="comm-room-card-footer">
                        <div className="comm-room-host-info">
                          <AvatarFrame frame={room.createdBy?.avatarDecoration} size="sm">
                            {room.createdBy?.avatar ? (
                              <img
                                src={room.createdBy.avatar}
                                alt={room.createdBy.displayName || "Host"}
                                className="comm-room-host-img"
                              />
                            ) : (
                              <div className="comm-room-host-placeholder">
                                {(room.createdBy?.displayName || room.createdBy?.username || "H")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}
                          </AvatarFrame>
                          <span className="comm-room-host-name">
                            Host: @{room.createdBy?.username || "anonymous"}
                          </span>
                        </div>

                        <button
                          type="button"
                          className="btn-join-room-card"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJoinMeetingRoomClick(room);
                          }}
                        >
                          <VideoIcon size={15} />
                          <span>Join Room</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MODERATION & DASHBOARD */}
        {activeTab === "moderation" && isMod && (
          <div className="comm-mod-dashboard">
            {/* Moderation Subtabs */}
            <div className="comm-mod-subtabs">
              <button
                type="button"
                className={`comm-mod-subtab-btn ${modSubtab === "overview" ? "active" : ""}`}
                onClick={() => setModSubtab("overview")}
              >
                <SlidersIcon size={15} />
                <span>Overview</span>
              </button>

              <button
                type="button"
                className={`comm-mod-subtab-btn ${modSubtab === "members" ? "active" : ""}`}
                onClick={() => setModSubtab("members")}
              >
                <UsersIcon size={15} />
                <span>Manage Members</span>
              </button>

              <button
                type="button"
                className={`comm-mod-subtab-btn ${modSubtab === "reports" ? "active" : ""}`}
                onClick={() => setModSubtab("reports")}
              >
                <AlertTriangleIcon size={15} />
                <span>Reports</span>
                {reports.filter((r) => r.status === "PENDING").length > 0 && (
                  <span className="comm-mod-badge-count">
                    {reports.filter((r) => r.status === "PENDING").length}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`comm-mod-subtab-btn ${modSubtab === "banned" ? "active" : ""}`}
                onClick={() => setModSubtab("banned")}
              >
                <BanIcon size={15} />
                <span>Banned Users ({bannedUsers.length})</span>
              </button>

              <button
                type="button"
                className={`comm-mod-subtab-btn ${modSubtab === "history" ? "active" : ""}`}
                onClick={() => setModSubtab("history")}
              >
                <ClockIcon size={15} />
                <span>Audit History</span>
              </button>

              {isOwner && (
                <button
                  type="button"
                  className={`comm-mod-subtab-btn ${modSubtab === "settings" ? "active" : ""}`}
                  onClick={() => setModSubtab("settings")}
                >
                  <SettingsIcon size={15} />
                  <span>Settings</span>
                </button>
              )}
            </div>

            {/* SUBTAB 1: OVERVIEW */}
            {modSubtab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {/* 4 Metrics */}
                <div className="comm-mod-metrics-grid">
                  <div className="comm-mod-metric-card">
                    <div className="comm-mod-metric-icon" style={{ color: "#38bdf8" }}>
                      👥
                    </div>
                    <div className="comm-mod-metric-info">
                      <span className="comm-mod-metric-num">{community.memberCount || 0}</span>
                      <span className="comm-mod-metric-label">Total Members</span>
                    </div>
                  </div>

                  <div className="comm-mod-metric-card">
                    <div className="comm-mod-metric-icon" style={{ color: "#818cf8" }}>
                      🛡️
                    </div>
                    <div className="comm-mod-metric-info">
                      <span className="comm-mod-metric-num">{(community.moderators?.length || 0) + 1}</span>
                      <span className="comm-mod-metric-label">Active Moderators</span>
                    </div>
                  </div>

                  <div className="comm-mod-metric-card">
                    <div className="comm-mod-metric-icon" style={{ color: "#f87171" }}>
                      🚫
                    </div>
                    <div className="comm-mod-metric-info">
                      <span className="comm-mod-metric-num">{bannedUsers.length}</span>
                      <span className="comm-mod-metric-label">Banned Users</span>
                    </div>
                  </div>

                  <div className="comm-mod-metric-card">
                    <div className="comm-mod-metric-icon" style={{ color: "#facc15" }}>
                      ⚠️
                    </div>
                    <div className="comm-mod-metric-info">
                      <span className="comm-mod-metric-num">{reports.filter((r) => r.status === "PENDING").length}</span>
                      <span className="comm-mod-metric-label">Open Reports</span>
                    </div>
                  </div>
                </div>

                {/* Quick Add Moderator (Owner Only) */}
                {isOwner && (
                  <div className="add-mod-box">
                    <h4>👑 Appoint Moderator</h4>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
                      Appoint trusted members to help moderate chat, manage reports, and protect the community.
                    </p>
                    <form onSubmit={handleAddModerator} className="add-mod-form">
                      <input
                        type="text"
                        placeholder="Enter member's exact username..."
                        value={modTargetUsername}
                        onChange={(e) => setModTargetUsername(e.target.value)}
                        className="add-mod-input"
                      />
                      <button type="submit" className="add-mod-submit-btn" disabled={addingMod || !modTargetUsername.trim()}>
                        {addingMod ? <LoaderIcon size={16} /> : "Add Moderator"}
                      </button>
                    </form>
                  </div>
                )}

                {/* Recent Audit Log Preview */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4>Recent Moderation Events</h4>
                    <button
                      type="button"
                      onClick={() => setModSubtab("history")}
                      style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 13, fontWeight: 700 }}
                    >
                      View All History →
                    </button>
                  </div>
                  {modLogs.slice(0, 5).map((log) => (
                    <div key={log._id} className="comm-audit-item">
                      <div className="comm-audit-left">
                        <span className={`comm-audit-badge ${log.action.toLowerCase().includes("promote") ? "promote" : log.action.toLowerCase().includes("ban") ? "ban" : log.action.toLowerCase().includes("demote") ? "demote" : "remove"}`}>
                          {log.action.replace("_", " ")}
                        </span>
                        <span style={{ fontSize: 13.5, color: "var(--text-main)" }}>
                          <strong>@{log.moderator?.username || "mod"}</strong> performed action on{" "}
                          <strong>@{log.targetUser?.username || "user"}</strong>
                        </span>
                      </div>
                      <span className="comm-audit-time">
                        {new Date(log.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                  ))}
                  {modLogs.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--text-dim)" }}>No recent moderation events logged yet.</p>
                  )}
                </div>
              </div>
            )}

            {/* SUBTAB 2: MEMBERS */}
            {modSubtab === "members" && (
              <div className="comm-members-layout">
                <div className="comm-members-toolbar">
                  <div className="comm-members-search-box">
                    <SearchIcon size={16} />
                    <input
                      type="text"
                      placeholder="Search members to moderate..."
                      value={memberSearchQuery}
                      onChange={(e) => setMemberSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="comm-role-filter-pills">
                    <button
                      type="button"
                      className={`comm-role-pill-btn ${selectedRoleFilter === "ALL" ? "active" : ""}`}
                      onClick={() => setSelectedRoleFilter("ALL")}
                    >
                      All ({memberCounts.all || 0})
                    </button>
                    <button
                      type="button"
                      className={`comm-role-pill-btn ${selectedRoleFilter === "MODERATOR" ? "active" : ""}`}
                      onClick={() => setSelectedRoleFilter("MODERATOR")}
                    >
                      🛡️ Moderators ({memberCounts.moderators || 0})
                    </button>
                    <button
                      type="button"
                      className={`comm-role-pill-btn ${selectedRoleFilter === "MEMBER" ? "active" : ""}`}
                      onClick={() => setSelectedRoleFilter("MEMBER")}
                    >
                      🎓 Members ({memberCounts.members || 0})
                    </button>
                  </div>
                </div>

                <div className="comm-members-grid">
                  {members.map((member) => {
                    const isSelf = member._id === user?.id || member._id === user?._id;
                    const canManage = (isOwner && !isSelf) || (isMod && member.role === "MEMBER" && !isSelf);

                    return (
                      <div key={member._id} className="comm-member-card">
                        <div className="comm-member-top-row">
                          <Link to={`/profile/${member.username}`} className="comm-member-user-link">
                            <AvatarFrame frame={member.avatarDecoration} size="md">
                              {member.avatar ? (
                                <img src={member.avatar} alt={member.displayName} />
                              ) : (
                                (member.displayName || member.username || "U").charAt(0).toUpperCase()
                              )}
                            </AvatarFrame>
                            <div className="comm-member-names">
                              <span className="comm-member-display-name">{member.displayName || member.username}</span>
                              <span className="comm-member-handle">@{member.username}</span>
                            </div>
                          </Link>
                          <span className={`comm-member-role-tag ${member.role.toLowerCase()}`}>
                            {member.role === "OWNER" && "👑 Owner"}
                            {member.role === "MODERATOR" && "🛡️ Mod"}
                            {member.role === "MEMBER" && "🎓 Member"}
                          </span>
                        </div>

                        {canManage && (
                          <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                            {isOwner && member.role === "MEMBER" && (
                              <button
                                type="button"
                                className="comm-role-pill-btn"
                                onClick={() => handlePromoteModerator(member._id, member.username)}
                              >
                                + Make Mod
                              </button>
                            )}

                            {isOwner && member.role === "MODERATOR" && (
                              <button
                                type="button"
                                className="comm-role-pill-btn"
                                onClick={() => handleRemoveModerator(member._id, member.username)}
                              >
                                Demote
                              </button>
                            )}

                            <button
                              type="button"
                              className="comm-role-pill-btn"
                              style={{ color: "#f87171" }}
                              onClick={() => handleRemoveMember(member._id, member.username)}
                            >
                              Remove
                            </button>

                            <button
                              type="button"
                              className="comm-role-pill-btn"
                              style={{ color: "#f87171" }}
                              onClick={() => {
                                setBanModalUser(member);
                                setBanReason("");
                              }}
                            >
                              Ban
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SUBTAB 3: REPORTS */}
            {modSubtab === "reports" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {["ALL", "PENDING", "RESOLVED", "DISMISSED"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      className={`comm-role-pill-btn ${reportStatusFilter === st ? "active" : ""}`}
                      onClick={() => setReportStatusFilter(st)}
                    >
                      {st === "ALL" ? "All Reports" : st.charAt(0) + st.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>

                {loadingReports ? (
                  <div className="comm-rooms-loading">
                    <LoaderIcon size={28} />
                    <span>Loading reports...</span>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="comm-rooms-empty">
                    <CheckCircleIcon size={40} />
                    <h3>No reports found</h3>
                    <p>There are currently no reports matching this filter.</p>
                  </div>
                ) : (
                  <div className="comm-reports-list">
                    {reports.map((r) => (
                      <div key={r._id} className="comm-report-card">
                        <div className="comm-report-header">
                          <div>
                            <span className="comm-report-reason-badge">{r.reason}</span>
                            <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
                              Reported by <strong>@{r.reporter?.username}</strong> on{" "}
                              {new Date(r.createdAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                          <span className={`comm-report-status-badge ${r.status.toLowerCase()}`}>
                            {r.status}
                          </span>
                        </div>

                        {r.targetUser && (
                          <div style={{ fontSize: 13.5, color: "var(--text-main)" }}>
                            Target User: <strong>@{r.targetUser.username}</strong> ({r.targetUser.displayName})
                          </div>
                        )}

                        {r.details && <div className="comm-report-details">{r.details}</div>}

                        {r.resolutionNotes && (
                          <div style={{ fontSize: 12.5, color: "var(--text-muted)", fontStyle: "italic" }}>
                            Resolution notes: {r.resolutionNotes} (by @{r.resolvedBy?.username})
                          </div>
                        )}

                        {r.status === "PENDING" && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                            <textarea
                              placeholder="Add resolution notes (optional)..."
                              value={resolutionNotesMap[r._id] || ""}
                              onChange={(e) =>
                                setResolutionNotesMap({ ...resolutionNotesMap, [r._id]: e.target.value })
                              }
                              rows={2}
                              style={{
                                background: "rgba(0,0,0,0.25)",
                                border: "1px solid var(--border-color)",
                                borderRadius: 8,
                                color: "var(--text-main)",
                                padding: 8,
                                fontSize: 13
                              }}
                            />
                            <div className="comm-report-actions-row">
                              <button
                                type="button"
                                className="comm-report-resolve-btn"
                                onClick={() => handleResolveReport(r._id, "RESOLVED")}
                                disabled={resolvingReportId === r._id}
                              >
                                Mark Resolved
                              </button>
                              <button
                                type="button"
                                className="comm-report-dismiss-btn"
                                onClick={() => handleResolveReport(r._id, "DISMISSED")}
                                disabled={resolvingReportId === r._id}
                              >
                                Dismiss Report
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 4: BANNED USERS */}
            {modSubtab === "banned" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {loadingBanned ? (
                  <div className="comm-rooms-loading">
                    <LoaderIcon size={28} />
                    <span>Loading banned accounts...</span>
                  </div>
                ) : bannedUsers.length === 0 ? (
                  <div className="comm-rooms-empty">
                    <ShieldIcon size={40} />
                    <h3>No banned users</h3>
                    <p>No users are currently banned from this community.</p>
                  </div>
                ) : (
                  <div className="comm-banned-list">
                    {bannedUsers.map((b) => (
                      <div key={b._id} className="comm-banned-card">
                        <div className="comm-banned-user-info">
                          <AvatarFrame size="md">
                            {b.user?.avatar ? (
                              <img src={b.user.avatar} alt={b.user.username} />
                            ) : (
                              (b.user?.displayName || b.user?.username || "U").charAt(0).toUpperCase()
                            )}
                          </AvatarFrame>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                              {b.user?.displayName || b.user?.username} (@{b.user?.username})
                            </span>
                            <span className="comm-banned-reason">Reason: {b.reason || "Violation of rules"}</span>
                            <span style={{ fontSize: 11.5, color: "var(--text-dim)" }}>
                              Banned by @{b.bannedBy?.username || "mod"} on{" "}
                              {new Date(b.bannedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn-unban"
                          onClick={() => handleUnbanMember(b.user?._id, b.user?.username)}
                        >
                          Unban User
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 5: AUDIT LOG HISTORY */}
            {modSubtab === "history" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {loadingLogs ? (
                  <div className="comm-rooms-loading">
                    <LoaderIcon size={28} />
                    <span>Loading audit log...</span>
                  </div>
                ) : modLogs.length === 0 ? (
                  <div className="comm-rooms-empty">
                    <ClockIcon size={40} />
                    <h3>No moderation history</h3>
                    <p>All moderator actions will be logged here automatically.</p>
                  </div>
                ) : (
                  <div className="comm-audit-timeline">
                    {modLogs.map((log) => (
                      <div key={log._id} className="comm-audit-item">
                        <div className="comm-audit-left">
                          <span
                            className={`comm-audit-badge ${
                              log.action.includes("PROMOTE")
                                ? "promote"
                                : log.action.includes("BAN")
                                ? "ban"
                                : log.action.includes("DEMOTE")
                                ? "demote"
                                : log.action.includes("UNBAN")
                                ? "unban"
                                : "remove"
                            }`}
                          >
                            {log.action.replace(/_/g, " ")}
                          </span>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontSize: 13.5, color: "var(--text-main)" }}>
                              <strong>@{log.moderator?.username || "moderator"}</strong>{" "}
                              {log.action.toLowerCase().replace(/_/g, " ")}{" "}
                              {log.targetUser?.username && <strong>@{log.targetUser.username}</strong>}
                            </span>
                            {log.reason && (
                              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                Reason: "{log.reason}"
                              </span>
                            )}
                          </div>
                        </div>

                        <span className="comm-audit-time">
                          {new Date(log.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* SUBTAB 6: SETTINGS (Owner only) */}
            {modSubtab === "settings" && isOwner && (
              <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 540 }}>
                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-main)", marginBottom: 6, display: "block" }}>
                    Community Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={settingsForm.name}
                    onChange={(e) => setSettingsForm({ ...settingsForm, name: e.target.value })}
                    maxLength={80}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      color: "var(--text-main)"
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: 13.5, color: "var(--text-main)", marginBottom: 6, display: "block" }}>
                    Description / About
                  </label>
                  <textarea
                    value={settingsForm.description}
                    onChange={(e) => setSettingsForm({ ...settingsForm, description: e.target.value })}
                    rows={3}
                    maxLength={400}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      background: "rgba(0,0,0,0.3)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      color: "var(--text-main)"
                    }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={settingsForm.isPrivate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, isPrivate: e.target.checked })}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>
                      Make Community Private (Members must be invited or approved)
                    </span>
                  </label>

                  <label className="checkbox-label" style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={settingsForm.allowMemberPosts}
                      onChange={(e) => setSettingsForm({ ...settingsForm, allowMemberPosts: e.target.checked })}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-main)" }}>
                      Allow Members to post in Discussion & Feed
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="glow-button"
                  disabled={savingSettings || !settingsForm.name.trim()}
                  style={{
                    alignSelf: "flex-start",
                    padding: "10px 24px",
                    borderRadius: 8,
                    background: "var(--primary)",
                    color: "white",
                    fontWeight: 700,
                    border: "none",
                    cursor: "pointer"
                  }}
                >
                  {savingSettings ? <LoaderIcon size={16} /> : "Save Changes"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>

      {/* Create Meeting Room Modal */}
      {showCreateRoomModal && (
        <div className="create-room-modal-overlay">
          <div className="create-room-modal-card">
            <div className="create-room-modal-header">
              <h3>Create Community Meeting Room</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setShowCreateRoomModal(false)}
              >
                <XIcon size={18} />
              </button>
            </div>

            <div className="comm-room-limit-notice">
              {isProUser ? (
                <span>👑 <strong>ANOY Pro Account</strong>: You can host up to <strong>15 participants</strong> in this meeting room.</span>
              ) : (
                <span>ℹ️ <strong>Free Account</strong>: Meeting rooms host up to <strong>5 participants</strong>. ANOY Pro unlocks up to 15 participants.</span>
              )}
            </div>

            <form onSubmit={handleCreateMeetingRoom} className="create-room-form">
              <div className="form-group">
                <label>Room Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201 Midterm Study Session"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  maxLength={60}
                />
              </div>

              <div className="form-group">
                <label>Topic / Description</label>
                <textarea
                  placeholder="What is this meeting room for?"
                  value={newRoomDesc}
                  onChange={(e) => setNewRoomDesc(e.target.value)}
                  rows={3}
                  maxLength={200}
                />
              </div>

              <div className="form-group">
                <label>Max Capacity: {newRoomMax} Participants ({isProUser ? "Pro max: 15" : "Free max: 5"})</label>
                <input
                  type="range"
                  min="2"
                  max={isProUser ? 15 : 5}
                  value={newRoomMax}
                  onChange={(e) => setNewRoomMax(Number(e.target.value))}
                />
              </div>

              <div className="form-group-checkbox">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newRoomPrivate}
                    onChange={(e) => setNewRoomPrivate(e.target.checked)}
                  />
                  <span>Require Passcode to Join</span>
                </label>
              </div>

              {newRoomPrivate && (
                <div className="form-group">
                  <label>Passcode *</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter room passcode"
                    value={newRoomPasscode}
                    onChange={(e) => setNewRoomPasscode(e.target.value)}
                  />
                </div>
              )}

              <div className="create-room-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setShowCreateRoomModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-submit"
                  disabled={!newRoomName.trim() || creatingRoom}
                >
                  {creatingRoom ? <LoaderIcon size={16} /> : "Create & Launch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {banModalUser && (
        <div className="create-room-modal-overlay">
          <div className="create-room-modal-card">
            <div className="create-room-modal-header">
              <h3 style={{ color: "#f87171" }}>🚫 Ban @{banModalUser.username} from Community</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setBanModalUser(null)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14 }}>
              Banning this user will remove them from the community, revoke their chat/meeting room access, and prevent them from re-joining. Their global ANOY account will remain intact.
            </p>

            <form onSubmit={handleConfirmBan} className="create-room-form">
              <div className="form-group">
                <label>Ban Reason *</label>
                <textarea
                  required
                  placeholder="e.g. Repeated violation of community guidelines / harassment"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  rows={3}
                  maxLength={300}
                />
              </div>

              <div className="create-room-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setBanModalUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-submit"
                  style={{ background: "#dc2626" }}
                  disabled={banningUser || !banReason.trim()}
                >
                  {banningUser ? <LoaderIcon size={16} /> : "Confirm Ban"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report User Modal */}
      {reportModalUser && (
        <div className="create-room-modal-overlay">
          <div className="create-room-modal-card">
            <div className="create-room-modal-header">
              <h3>⚠️ Report @{reportModalUser.username} to Moderators</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setReportModalUser(null)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 14 }}>
              Your report will be sent to the community owner and moderators for review.
            </p>

            <form onSubmit={handleSubmitReport} className="create-room-form">
              <div className="form-group">
                <label>Reason *</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    background: "rgba(0,0,0,0.4)",
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    color: "var(--text-main)"
                  }}
                >
                  <option value="Violation of community rules">Violation of community rules</option>
                  <option value="Harassment / Bullying">Harassment / Bullying</option>
                  <option value="Spam / Unsolicited promotion">Spam / Unsolicited promotion</option>
                  <option value="Inappropriate content / Media">Inappropriate content / Media</option>
                  <option value="Impersonation / Fake account">Impersonation / Fake account</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group">
                <label>Additional Details (Optional)</label>
                <textarea
                  placeholder="Provide context or specify messages involved..."
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="create-room-modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setReportModalUser(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-submit"
                  disabled={submittingReport}
                >
                  {submittingReport ? <LoaderIcon size={16} /> : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passcode Prompt Modal */}
      {promptRoom && (
        <div className="passcode-modal-overlay">
          <div className="passcode-modal-card">
            <div className="passcode-modal-header">
              <h3>🔒 Enter Room Passcode</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setPromptRoom(null)}
              >
                <XIcon size={18} />
              </button>
            </div>
            <p>"{promptRoom.name}" requires a passcode to enter.</p>

            <form onSubmit={handlePasscodeSubmit} className="passcode-form">
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter passcode..."
                value={enteredPasscode}
                onChange={(e) => setEnteredPasscode(e.target.value)}
                className="passcode-input"
              />
              <div className="passcode-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={() => setPromptRoom(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-join-submit"
                  disabled={!enteredPasscode.trim() || joiningRoom}
                >
                  {joiningRoom ? <LoaderIcon size={16} /> : "Join Meeting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Boost Modal */}
      {showBoostModal && (
        <div className="boost-modal-overlay">
          <div className="boost-modal-card">
            <div className="boost-modal-header">
              <h3>🚀 Boost {community.name}</h3>
              <button type="button" onClick={() => setShowBoostModal(false)} className="close-btn">
                <XIcon size={18} />
              </button>
            </div>
            <p>Level up this community to unlock premium badge styling and priority ranking in explore.</p>
            <div className="boost-modal-actions">
              <button type="button" className="btn-confirm-boost" onClick={handleBoost} disabled={boosting}>
                {boosting ? <LoaderIcon size={16} /> : "Confirm 1 Boost (Pro)"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

