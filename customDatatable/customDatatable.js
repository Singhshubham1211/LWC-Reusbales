

import { LightningElement, wire, track, api } from 'lwc';
import { getObjectInfo } from 'lightning/uiObjectInfoApi';
import { getPicklistValues } from 'lightning/uiObjectInfoApi';
import BLOCK_REASON_FIELD from '@salesforce/schema/Order.IPT_Block_Reason__c';
import STATUS_FIELD from '@salesforce/schema/Order.Status';
import getBlockedOrders from '@salesforce/apex/IPT_SEO_BlockOrders.getBlockedOrders';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import IPT_OLI_ReportId from '@salesforce/label/c.IPT_OLI_ReportId';

export default class Ipt_SEO_BlockedOrderListView extends NavigationMixin(LightningElement) {

    @track orders=[];


    @track blockReasonOptions = [];
    @track orderRecordType;
    @track error;

    @track statusOptions = [];
    @track selectedStatus = '';
    @track searchKey = '';


    @wire(getObjectInfo, { objectApiName: 'Order' })
    results({ error, data }) {
        if (data) {
            this.orderRecordType = data.defaultRecordTypeId;
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.orderRecordType = undefined;
        }
        console.log('Order Record Type Id:', this.orderRecordType);
    }

   @wire(getPicklistValues, { 
    recordTypeId: "$orderRecordType", 
    fieldApiName: BLOCK_REASON_FIELD
    })
    wiredBlockReasons({ error, data }) {
        if (data) {
            console.log('Picklist data:', data.values);
            this.blockReasonOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.blockReasonOptions = undefined;
        }
        console.log('Block Reason Options:', this.blockReasonOptions);
    }

    @wire(getPicklistValues, { 
        recordTypeId: "$orderRecordType", 
        fieldApiName: STATUS_FIELD
    })
    wiredStatus({ error, data }) {
        if (data) {
            this.statusOptions = data.values.map(item => ({
                label: item.label,
                value: item.value
            }));
            this.statusOptions.push({ label: 'All', value: 'All' });
            this.selectedStatus = 'All';
            this.error = undefined;
        } else if (error) {
            this.error = error;
            this.statusOptions = undefined;
        }
        console.log('Status Options:', this.statusOptions);
    }
    

    connectedCallback() {
        this.fetchBlockedOrders();
    }

    get filteredOrders() {
        let results = this.orders;

        
        if (this.searchKey) {
            const key = this.searchKey.toLowerCase();
            results = results.filter(o =>
                (o.OrderNumber && o.OrderNumber.toLowerCase().includes(key)) ||
                (o.SoldToPartyCode && o.SoldToPartyCode.toLowerCase().includes(key)) ||
                (o.ChannelPartnerName && o.ChannelPartnerName.toLowerCase().includes(key))
            );
        }

        
        if (this.selectedStatus && this.selectedStatus !== 'All') {
            results = results.filter(o => o.Status === this.selectedStatus);
        }

        return results;
    }

    fetchBlockedOrders() {
        getBlockedOrders()
            .then(data => {
                this.orders = data.map(o => ({
                        ...o,
                        OrderNumber: o.DMS_SAP_Order_Number__c || o.OrderNumber,
                        ChannelPartnerName: o.Account ? o.Account.Name : '',
                        SoldToPartyCode: o.Account ? o.Account.Cp_Sold_to_party_code__c : '',
                        TotalDiscountedPrice: o.DMS_Order_Total_List_Price__c,
                        CreatedDate: o.CreatedDate ? new Date(o.CreatedDate).toLocaleDateString() : '',
                        BlockReason: o.IPT_Block_Reason__c || '',
                        BlockRemarks: o.IPT_Remarks__c || '',
                        isSelected: false,
                        isNotSelected: true,
                        ReleaseRemarks: '',
                        IPT_Release_Remarks__c: '',
                        DMS_Block_Type__c: 'Delivery Block'
                    }));
                console.log('Fetched Blocked Orders:', this.orders);
            })
            .catch(error => {
                console.error('Error fetching blocked orders:', error);
            });
    }

    handleSearch(event) {
        this.searchKey = event.target.value;
    }

    handleRowSelect(event) {
        const orderId = event.target.dataset.id;
        this.orders = this.orders.map(o => 
            o.Id === orderId ? { ...o, isSelected: event.target.checked, isNotSelected: !event.target.checked } : o
        );
        const selectedOrders = this.orders.filter(o => o.isSelected);
        
        this.dispatchEvent(new CustomEvent('recordstoupdate', {detail : {records : selectedOrders}}));
    }

    handleReleaseRemarksChange(event) {
        const orderId = event.target.dataset.id;
        this.orders = this.orders.map(o => 
            o.Id === orderId ? { ...o, ReleaseRemarks: event.target.value, IPT_Release_Remarks__c: event.target.value } : o
        );
        const selectedOrders = this.orders.filter(o => o.isSelected);
        this.dispatchEvent(new CustomEvent('recordstoupdate', {detail : {records : selectedOrders}}));
    
    }

    handleViewLineItems(event) {
        // Navigate to report with filter
        const orderId = event.target.dataset.id;
        const reportId = IPT_OLI_ReportId; 
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: reportId,
                objectApiName: 'Report',
                actionName: 'view'
            },
            state: {
                fv0: orderId
            }
        });
    }

    showToast(title, message, variant) {
            const event = new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            });
            this.dispatchEvent(event);
        }

    handleNavigateToOrderRecord(event) {
        const orderId = event.target.dataset.id;
        console.log('Navigating to Order Id:', orderId);
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: orderId,
                objectApiName: 'Order',
                actionName: 'view'
            }
        });
    }

    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
        console.log('Selected Status:', this.selectedStatus);
        
    }
}