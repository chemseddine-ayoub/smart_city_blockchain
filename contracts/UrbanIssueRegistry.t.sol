// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {UrbanIssueRegistry} from "./UrbanIssueRegistry.sol";

contract UrbanIssueRegistryTest is Test {
    event IssueCreated(string issueId, address indexed reportedBy, uint256 reportDate);

    UrbanIssueRegistry private registry;
    string private constant ISSUE_ID = "CITY-2026-001";

    function setUp() public {
        registry = new UrbanIssueRegistry();
    }

    function test_CreateAndReadIssue() public {
        address citizen = address(0xA11CE);

        vm.prank(citizen);
        _createIssue();

        UrbanIssueRegistry.UrbanIssue memory issue = registry.getIssue(ISSUE_ID);

        assertEq(issue.location, "Avenue Mohammed V");
        assertEq(issue.description, "Lampe en panne");
        assertEq(uint256(issue.priority), uint256(UrbanIssueRegistry.Priority.High));
        assertEq(uint256(issue.status), uint256(UrbanIssueRegistry.Status.Reported));
        assertEq(issue.reportedBy, citizen);
        assertEq(issue.reportDate, block.timestamp);
        assertEq(issue.assignedTo, "");
    }

    function test_RejectDuplicateIssueId() public {
        _createIssue();

        vm.expectRevert(
            abi.encodeWithSignature("Error(string)", "Identifiant deja utilise")
        );
        _createIssue();
    }

    function test_RejectUnknownIssueId() public {
        vm.expectRevert(
            abi.encodeWithSignature("Error(string)", "Signalement introuvable")
        );
        registry.getIssue("CITY-2026-999");
    }

    function _createIssue() private {
        registry.createIssue(
            ISSUE_ID,
            "StreetLight",
            "Avenue Mohammed V",
            "Lampe en panne",
            UrbanIssueRegistry.Priority.High
        );
    }

    function test_CompleteWorkflowAndHistory() public {
        address citizen = address(0xA11CE);

        vm.prank(citizen);
        _createIssue();

        registry.assignIssue(ISSUE_ID, "Equipe 1", "Equipe affectee");
        registry.updateStatus(ISSUE_ID, UrbanIssueRegistry.Status.InProgress, "Intervention commencee");
        registry.updateStatus(ISSUE_ID, UrbanIssueRegistry.Status.Resolved, "Lampe reparee");
        registry.updateStatus(ISSUE_ID, UrbanIssueRegistry.Status.Closed, "Dossier clos");

        UrbanIssueRegistry.UrbanIssue memory issue = registry.getIssue(ISSUE_ID);
        assertEq(uint256(issue.status), uint256(UrbanIssueRegistry.Status.Closed));
        assertEq(issue.assignedTo, "Equipe 1");

        UrbanIssueRegistry.HistoryEntry[] memory history = registry.getHistory(ISSUE_ID);
        assertEq(history.length, 5);

        UrbanIssueRegistry.Status[5] memory expected = [
            UrbanIssueRegistry.Status.Reported,
            UrbanIssueRegistry.Status.Assigned,
            UrbanIssueRegistry.Status.InProgress,
            UrbanIssueRegistry.Status.Resolved,
            UrbanIssueRegistry.Status.Closed
        ];

        for (uint256 i = 0; i < expected.length; i++) {
            assertEq(uint256(history[i].status), uint256(expected[i]));
        }

        assertEq(history[0].actor, citizen);
        assertEq(history[1].actor, registry.municipality());
        assertEq(history[1].assignedTo, "Equipe 1");
        assertEq(history[3].comment, "Lampe reparee");
    }

    function test_CitizenCannotAssignOrUpdate() public {
        _createIssue();

        address citizen = address(0xA11CE);
        bytes memory reason = abi.encodeWithSignature(
            "Error(string)", "Action reservee a la municipalite"
        );

        vm.prank(citizen);
        vm.expectRevert(reason);
        registry.assignIssue(ISSUE_ID, "Equipe 1", "");

        registry.assignIssue(ISSUE_ID, "Equipe 1", "");

        vm.prank(citizen);
        vm.expectRevert(reason);
        registry.updateStatus(ISSUE_ID, UrbanIssueRegistry.Status.InProgress, "");
    }

    function test_CannotSkipStatus() public {
        _createIssue();
        registry.assignIssue(ISSUE_ID, "Equipe 1", "");

        vm.expectRevert(
            abi.encodeWithSignature("Error(string)", "Transition de statut invalide")
        );
        registry.updateStatus(ISSUE_ID, UrbanIssueRegistry.Status.Resolved, "");

        assertEq(registry.getHistory(ISSUE_ID).length, 2);
    }

    function test_CreationEmitsOneEventAndIndexesOneId() public {
        vm.recordLogs();
        vm.expectEmit(true, false, false, true, address(registry));
        emit IssueCreated(ISSUE_ID, address(this), block.timestamp);
        _createIssue();

        assertEq(vm.getRecordedLogs().length, 2); // The expected event and the real event.
        assertEq(registry.getIssueCount(), 1);
        assertEq(registry.getIssueIds(0, 10)[0], ISSUE_ID);
        assertEq(registry.getIssueIds(0, 0).length, 0);
        assertEq(registry.getIssueIds(1, 10).length, 0);
    }

    function test_ImportedValuesCannotSetAuthorTeamOrStatus() public {
        address citizen = address(0xA11CE);
        UrbanIssueRegistry.ImportSource memory source = UrbanIssueRegistry.ImportSource(
            "2026-11-19", "Citizen01", "UrbanTeam01", "Closed"
        );

        vm.prank(citizen);
        registry.createImportedIssue(
            ISSUE_ID, "StreetLight", "Avenue Mohammed V", "Lampe en panne",
            UrbanIssueRegistry.Priority.High, source
        );

        UrbanIssueRegistry.UrbanIssue memory issue = registry.getIssue(ISSUE_ID);
        UrbanIssueRegistry.ImportSource memory stored = registry.getImportSource(ISSUE_ID);
        assertEq(issue.reportedBy, citizen);
        assertEq(issue.reportDate, block.timestamp);
        assertEq(issue.assignedTo, "");
        assertEq(uint256(issue.status), uint256(UrbanIssueRegistry.Status.Reported));
        assertEq(stored.reportDate, source.reportDate);
        assertEq(stored.reportedBy, source.reportedBy);
        assertEq(stored.assignedTo, source.assignedTo);
        assertEq(stored.status, source.status);
        assertEq(registry.getHistory(ISSUE_ID).length, 1);
    }
}
