const NotificationBadge = ({ count, className = "" }) => {
  if (!count || count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count;

  return (
    <span className={`nav-badge ${className}`}>
      {displayCount}
    </span>
  );
};

export default NotificationBadge;
