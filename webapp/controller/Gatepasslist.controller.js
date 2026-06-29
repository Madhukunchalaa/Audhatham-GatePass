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
			sap.ui.core.BusyIndicator.show(0);

			oODataModel.read("/ZRgpNrgpSet", {
				urlParameters: { "$expand": "ZRGPNRGPItmNav" },
				success: function (oData) {
					sap.ui.core.BusyIndicator.hide();
					var aResults = (oData.results || []).map(function (oItem) {
						var sType = oItem.Type || "";
						if (sType === "NRGP") sType = "NRGP";
						else if (sType === "RGP") sType = "RGP";

						return {
							GatePassNo: oItem.GatePassNo || "",
							GatePassReqNo: oItem.GatePassNo || "",
							GatePassType: sType,
							Direction: oItem.Direction || "",
							Status: oItem.Status || "",
							Plant: oItem.Plant || "",
							Vendor: oItem.Vendor || "",
							VendorName: oItem.VendorName || "",
							Department: oItem.Department || "",
							VehicleNo: oItem.VehicleNo || "",
							ModeOfDispatch: oItem.ModeOfDispatch || "",
							DriverName: oItem.DriverName || "",
							GpDate: oItem.GpDate instanceof Date ? oItem.GpDate.toLocaleDateString('en-GB', {day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-') : (oItem.GpDate || ""),
							PurchaseOrder: oItem.PurchaseOrder || "",
							CustomerInvoice: oItem.CustomerInvoice || "",
							Remarks: oItem.Remarks || "",
							DocumentRef: oItem.DocumentRef || "",
							PendingAt: ""
						};
					});
					that.getView().getModel("gatePassList").setProperty("/items", aResults);
					that._updateCount();
				},
				error: function (oErr) {
					sap.ui.core.BusyIndicator.hide();
					var sMsg = "Failed to load gate pass list.";
					try { sMsg = JSON.parse(oErr.responseText).error.message.value; } catch (e) {}
					sap.m.MessageBox.error(sMsg);
				}
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
			this.byId("idTypeFilterSelect").setSelectedKey("");
			this.byId("idDirectionFilterSelect").setSelectedKey("");
			this._applyFilters();
		},

		_applyFilters: function () {
			var oBinding = this.byId("idItemsGatePassTable").getBinding("items");
			var aFilters = [];

			var sSearch = this.byId("idGatePassSearchField").getValue().trim();
			if (sSearch) {
				aFilters.push(new Filter("GatePassNo", FilterOperator.Contains, sSearch));
			}

			var sType = this.byId("idTypeFilterSelect").getSelectedKey();
			if (sType) {
				aFilters.push(new Filter("GatePassType", FilterOperator.EQ, sType));
			}

			var sDirection = this.byId("idDirectionFilterSelect").getSelectedKey();
			if (sDirection) {
				aFilters.push(new Filter("Direction", FilterOperator.EQ, sDirection));
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
			var sId = oItem.GatePassNo || "";
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
