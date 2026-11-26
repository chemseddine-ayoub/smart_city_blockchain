// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract UrbanIssueRegistry {
    enum Priority { Low, Medium, High }
    enum Status { Reported, Assigned, InProgress, Resolved, Closed }

    struct UrbanIssue {
        string issueType;
        string location;
        string description;
        Priority priority;
        Status status;
        address reportedBy;
        uint256 reportDate;
        string assignedTo;
    }

    mapping(string => UrbanIssue) private issues;
    string[] private issueIds;

    address public immutable municipality;

    struct HistoryEntry {
        Status status;
        string assignedTo;
        string comment;
        address actor;
        uint256 timestamp;
    }

    mapping(string => HistoryEntry[]) private histories;

    struct ImportSource {
        string reportDate;
        string reportedBy;
        string assignedTo;
        string status;
    }

    mapping(string => ImportSource) private importSources;

    event IssueAssigned(string issueId, string team, address indexed actor);
    event IssueStatusUpdated(
        string issueId,
        Status previousStatus,
        Status newStatus,
        address indexed actor
    );

    constructor() {
        municipality = msg.sender;
    }

    modifier onlyMunicipality() {
        require(msg.sender == municipality, "Action reservee a la municipalite");
        _;
    }

    event IssueCreated(
        string issueId,
        address indexed reportedBy,
        uint256 reportDate
    );

    function createIssue(
        string calldata issueId,
        string calldata issueType,
        string calldata location,
        string calldata description,
        Priority priority
    ) external {
        _createIssue(issueId, issueType, location, description, priority);
    }

    /// @notice Archive the spreadsheet values without granting any workflow permissions.
    function createImportedIssue(
        string calldata issueId,
        string calldata issueType,
        string calldata location,
        string calldata description,
        Priority priority,
        ImportSource calldata source
    ) external {
        _createIssue(issueId, issueType, location, description, priority);
        importSources[issueId] = source;
    }

    function _createIssue(
        string calldata issueId,
        string calldata issueType,
        string calldata location,
        string calldata description,
        Priority priority
    ) private {
        require(bytes(issueId).length > 0, "Identifiant vide");
        require(bytes(issueType).length > 0, "Type vide");
        require(bytes(location).length > 0, "Localisation vide");
        require(bytes(description).length > 0, "Description vide");

        UrbanIssue storage issue = issues[issueId];
        require(issue.reportedBy == address(0), "Identifiant deja utilise");

        issue.issueType = issueType;
        issue.location = location;
        issue.description = description;
        issue.priority = priority;
        issue.status = Status.Reported;
        issue.reportedBy = msg.sender;
        issue.reportDate = block.timestamp;
        issueIds.push(issueId);
        _recordHistory(issueId, issue, "Creation du signalement");
        emit IssueCreated(issueId, msg.sender, issue.reportDate);
    }

    function getIssue(string calldata issueId)
        external
        view
        returns (UrbanIssue memory)
    {
        return _existingIssue(issueId);
    }

    function getImportSource(string calldata issueId)
        external
        view
        returns (ImportSource memory)
    {
        _existingIssue(issueId);
        return importSources[issueId];
    }

    function getIssueCount() external view returns (uint256) {
        return issueIds.length;
    }

    function getIssueIds(uint256 offset, uint256 limit)
        external
        view
        returns (string[] memory ids)
    {
        if (offset >= issueIds.length) return new string[](0);
        uint256 remaining = issueIds.length - offset;
        uint256 size = limit < remaining ? limit : remaining;
        ids = new string[](size);
        for (uint256 i = 0; i < size; i++) {
            ids[i] = issueIds[offset + i];
        }
    }

    function assignIssue(
        string calldata issueId,
        string calldata team,
        string calldata comment
    ) external onlyMunicipality {
        UrbanIssue storage issue = _existingIssue(issueId);

        require(issue.status == Status.Reported, "Signalement deja affecte");
        require(bytes(team).length > 0, "Equipe vide");

        issue.assignedTo = team;
        issue.status = Status.Assigned;

        _recordHistory(issueId, issue, comment);
        emit IssueAssigned(issueId, team, msg.sender);
    }

    function updateStatus(
        string calldata issueId,
        Status newStatus,
        string calldata comment
    ) external onlyMunicipality {
        UrbanIssue storage issue = _existingIssue(issueId);
        Status previous = issue.status;

        bool allowed =
            (previous == Status.Assigned && newStatus == Status.InProgress) ||
            (previous == Status.InProgress && newStatus == Status.Resolved) ||
            (previous == Status.Resolved && newStatus == Status.Closed);

        require(allowed, "Transition de statut invalide");

        issue.status = newStatus;

        _recordHistory(issueId, issue, comment);
        emit IssueStatusUpdated(issueId, previous, newStatus, msg.sender);
    }

    function getHistory(string calldata issueId)
        external
        view
        returns (HistoryEntry[] memory)
    {
        _existingIssue(issueId);
        return histories[issueId];
    }

    function _existingIssue(string calldata issueId)
        private
        view
        returns (UrbanIssue storage issue)
    {
        issue = issues[issueId];
        require(issue.reportedBy != address(0), "Signalement introuvable");
    }

    function _recordHistory(
        string calldata issueId,
        UrbanIssue storage issue,
        string memory comment
    ) private {
        histories[issueId].push(
            HistoryEntry({
                status: issue.status,
                assignedTo: issue.assignedTo,
                comment: comment,
                actor: msg.sender,
                timestamp: block.timestamp
            })
        );
    }
}
