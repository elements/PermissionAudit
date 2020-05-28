import {wire, LightningElement} from 'lwc';
import getListOfSObjects from '@salesforce/apex/permissionAuditorHelper.getListOfSObjects';
import getMapOfFieldsByObject from '@salesforce/apex/permissionAuditorHelper.getMapOfFieldsByObject';
import getSObjectDataFromQueryString from '@salesforce/apex/permissionAuditorHelper.getSObjectDataFromQueryString';

export default class FieldAuditor extends LightningElement {
    // Form Props
    sObjectOptions;
    selectedObject;
    fieldOptions;
    selectedField;

    // Map of Permissions
    profileAndPermissionSetMap;

    // Datatable for Profile & Permission Sets
    profileColumns = [
        {label: 'Name', fieldName: 'name'},
        {label: 'Read Access', fieldName: 'read', type: 'boolean'},
        {label: 'Write Access', fieldName: 'write', type: 'boolean'}
    ];

    // Datatable for Users
    usersWithAccessColumns = [
        {label: 'User', fieldName: 'name'},
        {label: 'Profile', fieldName: 'profile'},
        {label: 'Read Access', fieldName: 'read', type: 'boolean'},
        {label: 'Write Access', fieldName: 'write', type: 'boolean'},
        {label: 'Permission Sets', fieldName: 'permissionSets'}
    ];

    // Datatable data
    profileData;
    permsetData;
    usersWithAccessData;

    // Wire sObjects
    @wire(getListOfSObjects)
    wiredsObjects(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            this.sObjectOptions = result.data.map(elm => ({value: elm, label: elm}));
        }
    }

    // Wire sObjects
    // Reactive prop $selectedObject
    @wire(getMapOfFieldsByObject, {sObjectName: '$selectedObject'})
    wiredFields(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            this.fieldOptions = Object.values(result.data).map(elm => ({
                value: elm.name,
                label: `${elm.label} (${elm.name})`
            }));
        }
    }

    // Wire Profile & PermissionSet Data
    // Reactive prop $_profileQuery
    @wire(getSObjectDataFromQueryString, {jsonRequest: '$_profileQuery'})
    wiredPermissionData(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            let profilesWithAccess = result.data.filter(elm => elm.Parent.IsOwnedByProfile === true);
            let permsetsWithAccess = result.data.filter(elm => elm.Parent.IsOwnedByProfile === false);

            // Populate Profile Datatable
            this.profileData = profilesWithAccess.map(row => ({
                id: row.ParentId,
                name: row.Parent.Profile.Name,
                read: row.PermissionsRead,
                write: row.PermissionsEdit
            })).sort((a, b) => a.name.localeCompare(b.name));

            // Populate PermissionSet Datatable
            this.permsetData = permsetsWithAccess.map(row => ({
                id: row.ParentId,
                name: row.Parent.Name,
                read: row.PermissionsRead,
                write: row.PermissionsEdit
            })).sort((a, b) => a.name.localeCompare(b.name));

            // Map Profile/Permset Permissions
            this.profileAndPermissionSetMap = result.data.reduce((perm, curr) => {
                let permId = (curr.Parent.IsOwnedByProfile ? curr.Parent.Profile.Id : curr.ParentId)
                if (!perm[permId]) perm[permId] = {
                    read: curr.PermissionsRead,
                    write: curr.PermissionsEdit
                };
                return perm;
            }, {});

            this._usersPermQuery = JSON.stringify({
                queryString: `SELECT AssigneeId, Assignee.Name, PermissionSet.Id, PermissionSet.isOwnedByProfile, 
                                 PermissionSet.Profile.Name, PermissionSet.Profile.Id, PermissionSet.Label
                    FROM PermissionSetAssignment
                    WHERE PermissionSetId
                        IN (SELECT ParentId
                            FROM FieldPermissions
                            WHERE SObjectType = '${this.selectedObject}' 
                                AND Field = '${this.selectedObject}.${this.selectedField}'
                            ) 
                            ORDER BY AssigneeId, PermissionSet.isOwnedByProfile DESC`
            });
        }
    }

    // Wire Users with Permissions
    // Reactive prop $_usersPermQuery
    @wire(getSObjectDataFromQueryString, {jsonRequest: '$_usersPermQuery'})
    wiredUserPermission(result) {
        if (result.error) {
            console.error(result.error);
        }

        if (result.data) {
            // Build Users with access table
            let usersWithAccess = result.data.filter(elm => elm.Assignee).reduce((user, curr) => {
                if (!user[curr.AssigneeId]) user[curr.AssigneeId] = {
                    profile: null,
                    permsets: [],
                    name: curr.Assignee.Name,
                    id: curr.AssigneeId,
                    read: false,
                    write: false
                }; // Initialize assigneeId doesnt exist
                if (curr.PermissionSet.IsOwnedByProfile) {
                    user[curr.AssigneeId].profile = curr.PermissionSet.Profile.Name;
                    // Populate Profile Permissions
                    user[curr.AssigneeId].read = this.profileAndPermissionSetMap[curr.PermissionSet.Profile.Id].read;
                    user[curr.AssigneeId].write = this.profileAndPermissionSetMap[curr.PermissionSet.Profile.Id].write;
                } else {
                    user[curr.AssigneeId].permsets.push(curr.PermissionSet.Label);
                    // Only set permissions to true if permission set is true since permissions are adding and not taking
                    if (this.profileAndPermissionSetMap[curr.PermissionSet.Id].read) user[curr.AssigneeId].read = true;
                    if (this.profileAndPermissionSetMap[curr.PermissionSet.Id].write) user[curr.AssigneeId].write = true;
                }
                return user;
            }, {});

            // Populate DataTable
            this.usersWithAccessData = Object.values(usersWithAccess).map(row => ({
                ...row,
                permissionSets: row.permsets.join(', ')
            }));
        }
    }


    handleSObjectChange(evt) {
        this.selectedObject = evt.detail.value;
        // Clear Selected Field
        this.selectedField = null;
        this._profileQuery = null;

        this.clearDataOnFieldChange();
    }

    handleFieldChange(evt) {
        this.selectedField = evt.detail.value;

        this.clearDataOnFieldChange();

        this._profileQuery = JSON.stringify({
            queryString: `SELECT SobjectType, Field, PermissionsRead, PermissionsEdit, ParentId, Parent.IsOwnedByProfile, 
                                Parent.Name, Parent.Profile.Name, Parent.Profile.Id
                            FROM FieldPermissions
                            WHERE SObjectType='${this.selectedObject}' 
                                AND Field = '${this.selectedObject}.${this.selectedField}'`
        });
    }

    clearDataOnFieldChange() {
        this.profileData = null;
        this.permsetData = null;

        this.usersWithAccessData = null;
    }


    // Private
    _profileQuery;
    _usersPermQuery;
}