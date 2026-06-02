sap.ui.define([
	"./BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/ui/model/json/JSONModel",
	"sap/m/MessageBox"
], function (BaseController, Filter, FilterOperator, JSONModel, MessageBox) {
	"use strict";

	return BaseController.extend("zaudgpms.audhatham.com.controller.GatePassList", {

		onInit: function () {
			this.getView().setModel(new JSONModel({ items: [] }), "gatePassList");
			this.getRouter().getRoute("GatePassList").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function () {
			this.getView().getModel("gatePassList").setProperty("/items", []);
			this._getData();
		},

		_getData: function () {
			var oODataModel = this.getOwnerComponent().getModel();
			if (!oODataModel) {
				return;
			}

			var that = this;
			var aAllResults = [];
			var iDone = 0;
			var iTarget = 3;

			function onBothDone() {
				iDone++;
				if (iDone === iTarget) {
					sap.ui.core.BusyIndicator.hide();
					aAllResults.forEach(function (oItem) {
						oItem.PendingAt = that._computePendingAt(oItem);
					});
					that.getView().getModel("gatePassList").setProperty("/items", aAllResults);
					that._updateCount();
				}
			}

			sap.ui.core.BusyIndicator.show(0);

			// 1. Fetch NRGP requests
			oODataModel.read("/GateReqHdrSet", {
				filters: [new Filter("GatePassType", FilterOperator.EQ, "NRGP"), new Filter("Status", FilterOperator.EQ, "All")],
				success: function (oData) {
					var aMapped = (oData.results || []).map(function (oItem) {
						var sRaw = oItem.ApprovalReq || oItem.Status || "";
						var sStatus = oItem.Status || "Pending";
						if (sRaw === "A" || sRaw === "APPROVED" || sRaw === "Approved") sStatus = "Approved";
						else if (sRaw === "R" || sRaw === "REJECTED" || sRaw === "Rejected") sStatus = "Rejected";
						else if (sRaw === "AM" || sRaw === "AMENDMENT" || sRaw === "Amendment") sStatus = "Amendment";

						oItem.Status = sStatus;
						return oItem;
					});
					aAllResults = aAllResults.concat(aMapped);
					onBothDone();
				},
				error: function () { onBothDone(); }
			});

			// 2. Fetch RGP requests
			oODataModel.read("/GateReqHdrSet", {
				filters: [new Filter("GatePassType", FilterOperator.EQ, "RGP"), new Filter("Status", FilterOperator.EQ, "All")],
				success: function (oData) {
					var aMapped = (oData.results || []).map(function (oItem) {
						var sRaw = oItem.ApprovalReq || oItem.Status || "";
						var sStatus = oItem.Status || "Pending";
						if (sRaw === "A" || sRaw === "APPROVED" || sRaw === "Approved") sStatus = "Approved";
						else if (sRaw === "R" || sRaw === "REJECTED" || sRaw === "Rejected") sStatus = "Rejected";
						else if (sRaw === "AM" || sRaw === "AMENDMENT" || sRaw === "Amendment") sStatus = "Amendment";

						oItem.Status = sStatus;
						return oItem;
					});
					aAllResults = aAllResults.concat(aMapped);
					onBothDone();
				},
				error: function () { onBothDone(); }
			});

			// 3. Fetch PO Gate Passes from GateInPoHdrSet (filtered by logged-in user's plant)
			var oUserModel = sap.ui.getCore().getModel("user");
			var sPlant = oUserModel ? oUserModel.getProperty("/Plant") : "";
			var aPoFilters = [];
			if (sPlant) {
				aPoFilters.push(new Filter("Plant", FilterOperator.EQ, sPlant));
			}

			// 3. Fetch PO Gate Passes from GateReqHdrSet (filtered by GatePassType eq 'PO')
			oODataModel.read("/GateReqHdrSet", {
				filters: [new Filter("GatePassType", FilterOperator.EQ, "PO"), new Filter("Status", FilterOperator.EQ, "All")],
				success: function (oData) {
					var aPoResults = (oData.results || []).map(function (oItem) {
						return {
							GatePassReqNo: "", // No request number for PO gate passes
							GatePassNo: oItem.GatePassNo || "",
							PurchaseOrder: oItem.GatePassReqNo || oItem.GatePassreqNo || "", // Store PO for dialog details
							GatePassType: "GP with PO",
							Status: oItem.Status || "Pending",
							Plant: oItem.Plant || "",
							VendorName: oItem.VendorName || "",
							Department: oItem.Department || "",
							VehicleNo: oItem.VehicleNo || "",
							PendingAt: ""
						};
					});
					aAllResults = aAllResults.concat(aPoResults);
					onBothDone();
				},
				error: function () { onBothDone(); }
			});
		},

		onSearchFieldLiveChange: function () {
			this._applyFilters();
		},

		onSelectFilterChange: function () {
			this._applyFilters();
		},

		onResetButtonPress: function () {
			this.byId("idGatePassSearchField").setValue("");
			this.byId("idStatusFilterSelect").setSelectedKey("");
			this.byId("idTypeFilterSelect").setSelectedKey("");
			this._applyFilters();
		},

		_applyFilters: function () {
			var oBinding = this.byId("idItemsGatePassTable").getBinding("items");
			var aFilters = [];

			var sSearch = this.byId("idGatePassSearchField").getValue().trim();
			if (sSearch) {
				aFilters.push(new Filter("GatePassReqNo", FilterOperator.Contains, sSearch));
			}

			var sStatus = this.byId("idStatusFilterSelect").getSelectedKey();
			if (sStatus) {
				aFilters.push(new Filter("Status", FilterOperator.EQ, sStatus));
			}

			var sType = this.byId("idTypeFilterSelect").getSelectedKey();
			if (sType) {
				aFilters.push(new Filter("GatePassType", FilterOperator.EQ, sType));
			}

			oBinding.filter(aFilters);
			this._updateCount();
		},

		_updateCount: function () {
			var oBinding = this.byId("idItemsGatePassTable").getBinding("items");
			if (oBinding) {
				this.byId("idItemCountText").setText(oBinding.getLength() + " Items");
			}
		},

		onColumnListItemPress: function (oEvent) {
			var oItem = oEvent.getSource().getBindingContext("gatePassList").getObject();
			var sId = oItem.GatePassReqNo || oItem.GatePassNo;
			this.getRouter().navTo("GatePassDetail", { reqNo: sId });
		},

		_computePendingAt: function (oItem) {
			if (oItem.GatePassType === "GP with PO") return "";
			if (oItem.Status !== "Pending") return "";
			if (!oItem.HODRemarks) return "HOD";
			if (!oItem.STORERemarks) return "Store";
			return "";
		},

		onApprovePress: function (oEvent) {
			var oItem = oEvent.getSource().getBindingContext("gatePassList").getObject();
			var oODataModel = this.getOwnerComponent().getModel();

			sap.ui.core.BusyIndicator.show(0);

			var sPath = oODataModel.createKey("/GateReqHdrSet", {
				GatePassReqNo: oItem.GatePassReqNo,
				GatePassType: oItem.GatePassType
			});

			oODataModel.update(sPath, {
				GatePassReqNo: oItem.GatePassReqNo,
				GatePassType: oItem.GatePassType,
				ApprovalReq: "A",
				Status: "Approved",
				HODRemarks: "Approved from list view"
			}, {
				success: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageBox.success("Gate Pass Request " + oItem.GatePassReqNo + " has been approved successfully!", {
						onClose: function () {
							var oCrossAppNavigator = sap.ushell && sap.ushell.Container && sap.ushell.Container.getService("CrossApplicationNavigation");
							if (oCrossAppNavigator) {
								oCrossAppNavigator.toExternal({
									target: { shellHash: "#WorkflowTask-displayInbox" }
								});
							} else {
								window.location.hash = "#WorkflowTask-displayInbox";
							}
						}
					});
				},
				error: function () {
					sap.ui.core.BusyIndicator.hide();
					MessageBox.error("Failed to approve Gate Pass Request " + oItem.GatePassReqNo + ". Please try again.");
				}
			});
		}

	});
});
